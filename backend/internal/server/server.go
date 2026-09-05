package server

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"log/slog"
	"net/http"
	"regexp"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"smartcinema/internal/repository"
	"strconv"
	"strings"
	"time"
)

type Server struct {
	Users          *auth.UserAdmin
	TrustedProxies []string
	Store          repository.Store
	PublicURL      string
	IPHashSecret   string
}

func (s *Server) Router(verifier auth.Verifier, origins []string) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	_ = r.SetTrustedProxies(s.TrustedProxies)
	r.Use(func(c *gin.Context) {
		id := domain.ID()
		c.Set("requestId", id)
		c.Header("X-Request-ID", id)
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("Cache-Control", "no-store")
		c.Header("X-Frame-Options", "DENY")
		for _, origin := range origins {
			if c.GetHeader("Origin") == origin {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Vary", "Origin")
				c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
				c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				c.Header("Access-Control-Expose-Headers", "X-Request-ID, Content-Disposition")
			}
		}
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 5<<20)
		start := time.Now()
		c.Next()
		slog.Info("request", "requestId", id, "method", c.Request.Method, "route", c.FullPath(), "status", c.Writer.Status(), "durationMs", time.Since(start).Milliseconds())
	})
	r.GET("/healthz", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	r.GET("/readyz", func(c *gin.Context) {
		_, e := s.Store.Count(c.Request.Context(), "feedback_config", bson.M{})
		if e != nil {
			fail(c, 503, "Database unavailable")
			return
		}
		c.JSON(200, gin.H{"status": "ready"})
	})
	p := r.Group("/api/v1/public")
	p.Use(s.rateLimit())
	p.GET("/feedback-config", s.publicConfig)
	p.GET("/feedback/:qrToken", s.validateQR)
	p.POST("/feedback", s.submitFeedback)
	a := r.Group("/api/v1/admin")
	a.Use(auth.Middleware(verifier))
	a.GET("/users", s.listUsers)
	a.POST("/users", s.saveUser)
	a.PUT("/users/:id", s.saveUser)
	a.GET("/me", func(c *gin.Context) { c.JSON(200, auth.Current(c)) })
	a.GET("/cinemas", s.listCinemas)
	a.POST("/cinemas", s.saveCinema)
	a.PUT("/cinemas/:id", s.saveCinema)
	a.GET("/staff", s.listStaff)
	a.POST("/staff", s.saveStaff)
	a.PUT("/staff/:id", s.saveStaff)
	a.POST("/staff/import", s.importStaff)
	a.GET("/staff/import/template", s.importTemplate)
	a.GET("/staff/:id/qr", s.getQR)
	a.POST("/staff/:id/qr", s.generateQR)
	a.POST("/staff/:id/qr/regenerate", s.regenerateQR)
	a.DELETE("/staff/:id/qr", s.disableQR)
	a.GET("/staff/:id/qr/download", s.downloadQR)
	a.POST("/staff/qr/batch", s.batchQR)
	a.GET("/staff/qr/package", s.qrPackage)
	a.GET("/feedbacks", s.listFeedback)
	a.GET("/feedbacks/export", s.exportFeedback)
	a.GET("/feedbacks/:id", s.feedbackDetail)
	a.GET("/feedback-config", s.adminConfig)
	a.PUT("/feedback-config", s.saveConfig)
	a.GET("/feedback-reasons", s.listReasons)
	a.POST("/feedback-reasons", s.saveReason)
	a.PUT("/feedback-reasons/:id", s.saveReason)
	a.GET("/dashboard", s.dashboard)
	a.GET("/dashboard/ranking", s.ranking)
	a.GET("/coaching", s.listCoaching)
	a.POST("/coaching", s.saveCoaching)
	a.GET("/coaching/:id", s.coachingDetail)
	a.PUT("/coaching/:id", s.saveCoaching)
	a.GET("/audit-logs", s.listAudit)
	return r
}
func fail(c *gin.Context, status int, msg string) {
	c.AbortWithStatusJSON(status, gin.H{"error": msg, "requestId": c.GetString("requestId")})
}
func dbError(c *gin.Context, e error) {
	if errors.Is(e, mongo.ErrNoDocuments) {
		fail(c, 404, "Record not found")
	} else if mongo.IsDuplicateKeyError(e) {
		fail(c, 409, "Code already exists")
	} else {
		slog.Error("database operation failed", "requestId", c.GetString("requestId"))
		fail(c, 500, "Unable to complete request")
	}
}
func decode(c *gin.Context, out any) bool {
	if c.ShouldBindJSON(out) != nil {
		fail(c, 400, "Invalid request body")
		return false
	}
	return true
}
func requireGlobal(c *gin.Context) bool {
	if !auth.Current(c).Global() {
		fail(c, 403, "Permission denied")
		return false
	}
	return true
}
func scope(c *gin.Context, key string) (bson.M, bool) {
	p := auth.Current(c)
	id := c.Query("cinemaId")
	if id != "" && !p.CanCinema(id) {
		fail(c, 403, "Permission denied")
		return nil, false
	}
	if !p.Global() {
		id = p.CinemaID
	}
	f := bson.M{}
	if id != "" {
		f[key] = id
	}
	return f, true
}
func page(c *gin.Context) (int64, int64) {
	p, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
	n, _ := strconv.ParseInt(c.DefaultQuery("pageSize", "20"), 10, 64)
	if p < 1 {
		p = 1
	}
	if p > 100000 {
		p = 100000
	}
	if n < 1 || n > 100 {
		n = 20
	}
	return p, n
}
func (s *Server) list(c *gin.Context, collection string, f bson.M, sort bson.D, out any) {
	p, n := page(c)
	ctx := c.Request.Context()
	count, e := s.Store.Count(ctx, collection, f)
	if e != nil {
		dbError(c, e)
		return
	}
	if e = s.Store.List(ctx, collection, f, sort, (p-1)*n, n, out); e != nil {
		dbError(c, e)
		return
	}
	c.JSON(200, gin.H{"items": out, "total": count, "page": p, "pageSize": n})
}
func (s *Server) staff(c *gin.Context, id string) (domain.Staff, bool) {
	var v domain.Staff
	e := s.Store.Get(c.Request.Context(), "staff", bson.M{"_id": id}, &v)
	if e != nil {
		dbError(c, e)
		return v, false
	}
	if !auth.Current(c).CanCinema(v.CinemaID) {
		fail(c, 403, "Permission denied")
		return v, false
	}
	return v, true
}
func (s *Server) mutate(c *gin.Context, action, target, cinema string, fn func(context.Context) error) bool {
	e := s.Store.Transaction(c.Request.Context(), func(ctx context.Context) error {
		if e := fn(ctx); e != nil {
			return e
		}
		return s.Store.Insert(ctx, "audit_logs", domain.Audit{ID: domain.ID(), Actor: auth.Current(c).Name, Action: action, Target: target, CinemaID: cinema, CreatedAt: time.Now().UTC()})
	})
	if e != nil {
		dbError(c, e)
		return false
	}
	return true
}
func (s *Server) hash(value string) string {
	h := hmac.New(sha256.New, []byte(s.IPHashSecret))
	h.Write([]byte(value))
	return hex.EncodeToString(h.Sum(nil))
}
func dateFilter(c *gin.Context, f bson.M) bool {
	bounds := bson.M{}
	for _, v := range []struct{ param, op string }{{"from", "$gte"}, {"to", "$lt"}} {
		if raw := c.Query(v.param); raw != "" {
			t, e := time.Parse(time.RFC3339, raw)
			if e != nil {
				fail(c, 400, "Use RFC3339 dates")
				return false
			}
			bounds[v.op] = t
		}
	}
	if len(bounds) > 0 {
		f["createdAt"] = bounds
	}
	return true
}
func search(c *gin.Context, f bson.M, fields ...string) {
	q := strings.TrimSpace(c.Query("search"))
	if len(q) > 100 {
		q = q[:100]
	}
	if q != "" {
		or := bson.A{}
		for _, k := range fields {
			or = append(or, bson.M{k: bson.M{"$regex": regexp.QuoteMeta(q), "$options": "i"}})
		}
		f["$or"] = or
	}
}
