package server

import (
	"context"
	"errors"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"net/http"
	"smartcinema/internal/domain"
	"strings"
	"time"
	"unicode/utf8"
)

func (s *Server) rateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		bucket := c.Request.Method
		if strings.HasPrefix(c.Request.URL.Path, "/api/v1/public/transaction/") {
			bucket = "POST"
		}
		max := 120
		if bucket == "POST" {
			max = 20
		}
		ok, e := s.Store.Allow(c.Request.Context(), "ip:"+s.hash(c.ClientIP())+":"+bucket, max)
		if e != nil {
			fail(c, 503, "Service temporarily unavailable")
			return
		}
		if !ok {
			c.Header("Retry-After", "60")
			fail(c, 429, "Vui lòng thử lại sau một phút")
			return
		}
		c.Next()
	}
}
func (s *Server) config(ctx context.Context) (domain.FeedbackConfig, error) {
	var v domain.FeedbackConfig
	if e := s.Store.Get(ctx, "feedback_config", bson.M{"_id": "default"}, &v); e != nil {
		return v, e
	}
	v.Reasons = []domain.Reason{}
	e := s.Store.List(ctx, "feedback_reasons", bson.M{}, bson.D{{Key: "order", Value: 1}}, 0, 0, &v.Reasons)
	return v, e
}
func (s *Server) publicConfig(c *gin.Context) {
	v, e := s.config(c.Request.Context())
	if e != nil {
		dbError(c, e)
		return
	}
	reasons := []domain.Reason{}
	for _, r := range v.Reasons {
		if r.Status == "ACTIVE" {
			reasons = append(reasons, r)
		}
	}
	v.Reasons = reasons
	c.JSON(200, v)
}
func (s *Server) resolve(ctx context.Context, token string) (domain.QR, domain.Staff, domain.Cinema, error) {
	var q domain.QR
	var st domain.Staff
	var ci domain.Cinema
	if len(token) != 32 {
		return q, st, ci, mongo.ErrNoDocuments
	}
	if e := s.Store.Get(ctx, "staff_qr_codes", bson.M{"publicToken": token, "status": "ACTIVE"}, &q); e != nil {
		return q, st, ci, e
	}
	if e := s.Store.Get(ctx, "staff", bson.M{"_id": q.StaffID, "status": "ACTIVE"}, &st); e != nil {
		return q, st, ci, e
	}
	if e := s.Store.Get(ctx, "cinemas", bson.M{"_id": st.CinemaID, "status": "ACTIVE"}, &ci); e != nil {
		return q, st, ci, e
	}
	return q, st, ci, nil
}
func (s *Server) validateQR(c *gin.Context) {
	_, _, _, e := s.resolve(c.Request.Context(), c.Param("qrToken"))
	if e != nil {
		if !errors.Is(e, mongo.ErrNoDocuments) {
			fail(c, 503, "Vui lòng thử lại sau")
		} else {
			fail(c, 404, "Mã QR hiện không khả dụng")
		}
		return
	}
	c.JSON(200, gin.H{"valid": true, "serverTime": time.Now().UTC()})
}

type submission struct {
	TransactionID     string `json:"transactionId"`
	TransactionSource string `json:"transactionSource"`

	QRToken        string   `json:"qrToken"`
	Rating         int      `json:"rating"`
	Reasons        []string `json:"reasons"`
	Name           string   `json:"name"`
	Phone          string   `json:"phone"`
	Comment        string   `json:"comment"`
	Consent        bool     `json:"consent"`
	ConsentVersion string   `json:"consentVersion"`
}

func (s *Server) submitFeedback(c *gin.Context) {
	var in submission
	if !decode(c, &in) {
		return
	}
	in.TransactionID, in.TransactionSource = domain.NormalizeTransaction(in.TransactionID, in.TransactionSource)
	in.Name = strings.TrimSpace(in.Name)
	phone, e := domain.NormalizePhone(in.Phone)
	if !domain.ValidName(in.Name) || e != nil || !in.Consent || utf8.RuneCountInString(in.Comment) > 2000 || len(in.Reasons) > 30 {
		fail(c, 422, "Vui lòng kiểm tra họ tên, số điện thoại, bình luận và đồng ý bảo mật")
		return
	}
	ok, e := s.Store.Allow(c.Request.Context(), "qr:"+s.hash(in.QRToken), 30)
	if e != nil {
		dbError(c, e)
		return
	}
	if !ok {
		c.Header("Retry-After", "60")
		fail(c, 429, "Vui lòng thử lại sau một phút")
		return
	}
	var out domain.Feedback
	invalid := errors.New("invalid feedback")
	invalidQR := errors.New("invalid qr")
	e = s.Store.Transaction(c.Request.Context(), func(ctx context.Context) error {
		q, st, ci, e := s.resolve(ctx, in.QRToken)
		if errors.Is(e, mongo.ErrNoDocuments) {
			return invalidQR
		}
		if e != nil {
			return e
		}
		// Serialize submissions and QR revocation on the same document. A conflict
		// retries the whole transaction, including repeated-phone detection.
		q.FeedbackRevision++
		if e = s.Store.Replace(ctx, "staff_qr_codes", q.ID, q); e != nil {
			return e
		}
		cfg, e := s.config(ctx)
		if e != nil {
			return e
		}
		if in.ConsentVersion != cfg.ConsentVersion {
			return invalid
		}
		var rating domain.Rating
		for _, r := range cfg.RatingOptions {
			if r.Value == in.Rating && r.Enabled {
				rating = r
			}
		}
		if rating.Value == 0 {
			return invalid
		}
		chosen := map[string]bool{}
		for _, code := range in.Reasons {
			if chosen[code] {
				return invalid
			}
			chosen[code] = true
		}
		reasons := []domain.Reason{}
		for _, r := range cfg.Reasons {
			applicable := r.Status == "ACTIVE" && domain.Contains(r.Ratings, in.Rating)
			if applicable && r.Required && !chosen[r.Code] {
				return invalid
			}
			if chosen[r.Code] {
				if !applicable {
					return invalid
				}
				reasons = append(reasons, r)
				delete(chosen, r.Code)
			}
		}
		if len(chosen) > 0 {
			return invalid
		}
		now := time.Now().UTC()
		duplicates, e := s.Store.Count(ctx, "feedbacks", bson.M{"staff.id": st.ID, "customer.phone": phone, "createdAt": bson.M{"$gte": now.Add(-10 * time.Minute)}})
		if e != nil {
			return e
		}
		out = domain.Feedback{ID: domain.ID(), Staff: domain.Snapshot{ID: st.ID, Code: st.StaffCode, Name: st.Name}, Cinema: domain.Snapshot{ID: ci.ID, Code: ci.Code, Name: ci.Name}, Customer: domain.Customer{Name: in.Name, Phone: phone}, Rating: rating, Reasons: reasons, Comment: strings.TrimSpace(in.Comment), CreatedAt: now}
		out.TransactionID = in.TransactionID
		out.TransactionSource = in.TransactionSource
		// No trusted POS resolver is configured. Never trust verification from the client.
		out.TransactionVerified = false
		if in.TransactionID != "" {
			// Serialize transaction dedupe across different staff QR tokens in the same cinema.
			if _, e = s.Store.Update(ctx, "cinemas", bson.M{"_id": ci.ID}, bson.M{"$inc": bson.M{"feedbackRevision": 1}}); e != nil {
				return e
			}
			repeated, err := s.Store.Count(ctx, "feedbacks", bson.M{"cinema.id": ci.ID, "transactionId": bson.M{"$regex": "^" + in.TransactionID + "(/[0-9]{3,5})?$"}, "createdAt": bson.M{"$gte": now.Add(-10 * time.Minute)}})
			if err != nil {
				return err
			}
			duplicates += repeated
		}
		out.QR.ID = q.ID
		out.QR.Token = q.PublicToken
		out.Metadata.IPHash = s.hash(c.ClientIP())
		ua := c.GetHeader("User-Agent")
		if len(ua) > 500 {
			ua = ua[:500]
		}
		out.Metadata.UserAgent = ua
		out.Metadata.Suspicious = duplicates > 0
		out.Consent.Accepted = true
		out.Consent.Version = cfg.ConsentVersion
		out.Consent.AcceptedAt = now
		if err := s.Store.Insert(ctx, "feedbacks", out); err != nil {
			return err
		}
		return s.queueFeedbackNotification(ctx, st, out)
	})
	if errors.Is(e, invalid) {
		fail(c, 422, "Đánh giá hoặc lý do không hợp lệ. Vui lòng tải lại cấu hình.")
		return
	}
	if errors.Is(e, invalidQR) {
		fail(c, 404, "Mã QR hiện không khả dụng")
		return
	}
	if e != nil {
		dbError(c, e)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"createdAt": out.CreatedAt})
}
