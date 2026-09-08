package server

import (
	"bytes"
	"encoding/csv"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"strconv"
	"strings"
	"time"
)

func feedbackFilter(c *gin.Context) (bson.M, bool) {
	f, ok := scope(c, "cinema.id")
	if !ok {
		return nil, false
	}
	if !dateFilter(c, f) {
		return nil, false
	}
	search(c, f, "customer.name", "customer.phone", "transactionId")
	switch c.Query("hasTransaction") {
	case "true":
		f["transactionId"] = bson.M{"$exists": true, "$nin": bson.A{"", nil}}
	case "false":
		f["$and"] = bson.A{bson.M{"$or": bson.A{bson.M{"transactionId": ""}, bson.M{"transactionId": nil}}}}
	case "":
	default:
		fail(c, 400, "Invalid transaction filter")
		return nil, false
	}
	for _, v := range []struct{ query, field string }{{"staffId", "staff.id"}, {"reason", "reasons.code"}} {
		if q := c.Query(v.query); q != "" {
			f[v.field] = q
		}
	}
	switch c.Query("rating") {
	case "negative":
		f["rating.value"] = bson.M{"$lte": 2}
	case "neutral":
		f["rating.value"] = 3
	case "positive":
		f["rating.value"] = bson.M{"$gte": 4}
	case "":
	default:
		n, e := strconv.Atoi(c.Query("rating"))
		if e != nil || n < 1 || n > 5 {
			fail(c, 400, "Invalid rating filter")
			return nil, false
		}
		f["rating.value"] = n
	}
	if c.Query("suspicious") == "true" {
		f["metadata.suspicious"] = true
	} else if c.Query("includeSuspicious") != "true" {
		f["metadata.suspicious"] = false
	}
	return f, true
}
func maskPhone(v string) string {
	if len(v) < 6 {
		return "••••"
	}
	return v[:2] + "••••" + v[len(v)-4:]
}
func (s *Server) listFeedback(c *gin.Context) {
	f, ok := feedbackFilter(c)
	if !ok {
		return
	}
	p, n := page(c)
	v := []domain.Feedback{}
	ctx := c.Request.Context()
	total, e := s.Store.Count(ctx, "feedbacks", f)
	if e == nil {
		e = s.Store.List(ctx, "feedbacks", f, bson.D{{Key: "createdAt", Value: -1}, {Key: "_id", Value: 1}}, (p-1)*n, n, &v)
	}
	if e != nil {
		dbError(c, e)
		return
	}
	for i := range v {
		v[i].Customer.Phone = maskPhone(v[i].Customer.Phone)
		v[i].Metadata.IPHash = ""
		v[i].Metadata.UserAgent = ""
		v[i].QR.Token = ""
	}
	c.JSON(200, gin.H{"items": v, "total": total, "page": p, "pageSize": n})
}
func (s *Server) feedbackDetail(c *gin.Context) {
	var v domain.Feedback
	e := s.Store.Get(c.Request.Context(), "feedbacks", bson.M{"_id": c.Param("id")}, &v)
	if e != nil {
		dbError(c, e)
		return
	}
	if !auth.Current(c).CanCinema(v.Cinema.ID) {
		fail(c, 403, "Permission denied")
		return
	}
	c.JSON(200, v)
}
func safeCSV(v string) string {
	if strings.ContainsAny(strings.TrimLeft(v, " \t\r\n")[:min(1, len(strings.TrimLeft(v, " \t\r\n")))], "=+-@") {
		return "'" + v
	}
	return v
}
func (s *Server) exportFeedback(c *gin.Context) {
	f, ok := feedbackFilter(c)
	if !ok {
		return
	}
	v := []domain.Feedback{}
	if e := s.Store.List(c.Request.Context(), "feedbacks", f, bson.D{{Key: "createdAt", Value: -1}}, 0, 10001, &v); e != nil {
		dbError(c, e)
		return
	}
	if len(v) > 10000 {
		fail(c, 422, "Narrow filters to at most 10000 records")
		return
	}
	var b bytes.Buffer
	b.WriteString("\xef\xbb\xbf")
	w := csv.NewWriter(&b)
	_ = w.Write([]string{"Time", "Rating", "Customer", "Phone", "Staff", "Cinema", "Reasons", "Comment", "Suspicious", "Transaction ID", "Transaction source", "Transaction verified"})
	for _, x := range v {
		reasons := []string{}
		for _, r := range x.Reasons {
			reasons = append(reasons, r.Label)
		}
		_ = w.Write([]string{x.CreatedAt.Format(time.RFC3339), strconv.Itoa(x.Rating.Value), safeCSV(x.Customer.Name), maskPhone(x.Customer.Phone), safeCSV(x.Staff.Code), safeCSV(x.Cinema.Name), safeCSV(strings.Join(reasons, "; ")), safeCSV(x.Comment), strconv.FormatBool(x.Metadata.Suspicious), safeCSV(x.TransactionID), safeCSV(x.TransactionSource), strconv.FormatBool(x.TransactionVerified)})
	}
	w.Flush()
	if w.Error() != nil {
		fail(c, 500, "Export failed")
		return
	}
	c.Header("Content-Disposition", `attachment; filename="feedback.csv"`)
	c.Data(200, "text/csv; charset=utf-8", b.Bytes())
}
func stage(key string, value any) bson.D { return bson.D{{Key: key, Value: value}} }
func groupMetrics(id any) bson.M {
	return bson.M{"_id": id, "count": bson.M{"$sum": 1}, "average": bson.M{"$avg": "$rating.value"}, "positive": bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$gte": bson.A{"$rating.value", 4}}, 1, 0}}}, "neutral": bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$rating.value", 3}}, 1, 0}}}, "negative": bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$lte": bson.A{"$rating.value", 2}}, 1, 0}}}}
}
func (s *Server) dashboard(c *gin.Context) {
	f, ok := feedbackFilter(c)
	if !ok {
		return
	}
	cfg, e := s.config(c.Request.Context())
	if e != nil {
		dbError(c, e)
		return
	}
	staffGroup := groupMetrics("$staff.id")
	staffGroup["unit"] = bson.M{"$last": "$staff"}
	staffGroup["cinema"] = bson.M{"$last": "$cinema"}
	cinemaGroup := groupMetrics("$cinema.id")
	cinemaGroup["unit"] = bson.M{"$last": "$cinema"}
	facets := bson.M{
		"summary":      bson.A{stage("$group", groupMetrics(nil))},
		"distribution": bson.A{stage("$group", bson.M{"_id": "$rating.value", "count": bson.M{"$sum": 1}}), stage("$sort", bson.D{{Key: "_id", Value: -1}})},
		"trend":        bson.A{stage("$group", groupMetrics(bson.M{"$dateToString": bson.M{"format": "%Y-%m-%d", "date": "$createdAt", "timezone": "Asia/Ho_Chi_Minh"}})), stage("$sort", bson.D{{Key: "_id", Value: 1}})},
		"hours":        bson.A{stage("$group", bson.M{"_id": bson.M{"$hour": bson.M{"date": "$createdAt", "timezone": "Asia/Ho_Chi_Minh"}}, "count": bson.M{"$sum": 1}}), stage("$sort", bson.D{{Key: "_id", Value: 1}})},
		"reasons":      bson.A{stage("$unwind", "$reasons"), stage("$group", bson.M{"_id": "$reasons.code", "label": bson.M{"$last": "$reasons.label"}, "english": bson.M{"$last": bson.M{"$ifNull": bson.A{"$reasons.english", ""}}}, "type": bson.M{"$last": "$reasons.type"}, "count": bson.M{"$sum": 1}}), stage("$sort", bson.D{{Key: "count", Value: -1}})},
		"staff":        bson.A{stage("$group", staffGroup), stage("$sort", bson.D{{Key: "average", Value: -1}, {Key: "count", Value: -1}}), stage("$limit", 100)},
		"cinemas":      bson.A{stage("$group", cinemaGroup), stage("$sort", bson.D{{Key: "average", Value: -1}})},
		"eligible":     bson.A{stage("$group", staffGroup), stage("$match", bson.M{"count": bson.M{"$gte": cfg.MinimumFeedbackForRanking}}), stage("$count", "count")},
	}
	var latest *domain.Coaching
	if staffID := c.Query("staffId"); staffID != "" {
		if _, ok := s.staff(c, staffID); !ok {
			return
		}
		cases := []domain.Coaching{}
		if err := s.Store.List(c.Request.Context(), "coaching", bson.M{"staffId": staffID}, bson.D{{Key: "createdAt", Value: -1}}, 0, 1, &cases); err != nil {
			dbError(c, err)
			return
		}
		if len(cases) > 0 {
			latest = &cases[0]
			facets["beforeCoaching"] = bson.A{stage("$match", bson.M{"createdAt": bson.M{"$lt": latest.CreatedAt}}), stage("$group", groupMetrics(nil))}
			facets["afterCoaching"] = bson.A{stage("$match", bson.M{"createdAt": bson.M{"$gte": latest.CreatedAt}}), stage("$group", groupMetrics(nil))}
		}
	}
	out := []bson.M{}
	e = s.Store.Aggregate(c.Request.Context(), "feedbacks", mongo.Pipeline{stage("$match", f), stage("$facet", facets)}, &out)
	if e != nil {
		dbError(c, e)
		return
	}
	v := bson.M{}
	if len(out) > 0 {
		v = out[0]
	}
	v["minimumFeedbackForRanking"] = cfg.MinimumFeedbackForRanking
	if latest != nil {
		v["latestCoaching"] = latest
	}
	c.JSON(200, v)
}
func (s *Server) ranking(c *gin.Context) {
	f, ok := feedbackFilter(c)
	if !ok {
		return
	}
	kind := c.DefaultQuery("kind", "staff")
	if kind != "staff" && kind != "cinema" {
		fail(c, 400, "Invalid ranking kind")
		return
	}
	if kind == "cinema" && !requireGlobal(c) {
		return
	}
	cfg, e := s.config(c.Request.Context())
	if e != nil {
		dbError(c, e)
		return
	}
	g := groupMetrics("$" + kind + ".id")
	g["unit"] = bson.M{"$last": "$" + kind}
	minimum := cfg.MinimumFeedbackForRanking
	out := []bson.M{}
	e = s.Store.Aggregate(c.Request.Context(), "feedbacks", mongo.Pipeline{stage("$match", f), stage("$group", g), stage("$facet", bson.M{"top": bson.A{stage("$match", bson.M{"count": bson.M{"$gte": minimum}}), stage("$sort", bson.D{{Key: "average", Value: -1}, {Key: "count", Value: -1}, {Key: "_id", Value: 1}}), stage("$limit", 20)}, "bottom": bson.A{stage("$match", bson.M{"count": bson.M{"$gte": minimum}}), stage("$sort", bson.D{{Key: "average", Value: 1}, {Key: "count", Value: -1}, {Key: "_id", Value: 1}}), stage("$limit", 20)}, "ineligible": bson.A{stage("$match", bson.M{"count": bson.M{"$lt": minimum}}), stage("$sort", bson.D{{Key: "count", Value: -1}}), stage("$limit", 100)}})}, &out)
	if e != nil {
		dbError(c, e)
		return
	}
	v := bson.M{}
	if len(out) > 0 {
		v = out[0]
	}
	v["minimumFeedbackForRanking"] = minimum
	c.JSON(200, v)
}
