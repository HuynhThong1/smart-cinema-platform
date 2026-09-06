package server

import (
	"context"
	"errors"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"strings"
	"time"
)

func (s *Server) listCinemas(c *gin.Context) {
	f, ok := scope(c, "_id")
	if !ok {
		return
	}
	v := []domain.Cinema{}
	search(c, f, "name", "code")
	s.list(c, "cinemas", f, bson.D{{Key: "code", Value: 1}}, &v)
}
func (s *Server) saveCinema(c *gin.Context) {
	if !requireGlobal(c) {
		return
	}
	var v domain.Cinema
	if !decode(c, &v) {
		return
	}
	v.Name = strings.TrimSpace(v.Name)
	v.Code = strings.ToUpper(strings.TrimSpace(v.Code))
	if !domain.ValidName(v.Name) || len(v.Code) < 2 || len(v.Code) > 30 || !domain.ValidStatus(v.Status) {
		fail(c, 422, "Name, code and valid status required")
		return
	}
	v.UpdatedAt = time.Now().UTC()
	action := "CREATE_CINEMA"
	v.ID = c.Param("id")
	if v.ID == "" {
		v.ID = domain.ID()
		v.CreatedAt = v.UpdatedAt
	} else {
		var old domain.Cinema
		if e := s.Store.Get(c.Request.Context(), "cinemas", bson.M{"_id": v.ID}, &old); e != nil {
			dbError(c, e)
			return
		}
		v.CreatedAt = old.CreatedAt
		action = "UPDATE_CINEMA"
	}
	if s.mutate(c, action, v.ID, v.ID, func(ctx context.Context) error {
		if action == "CREATE_CINEMA" {
			return s.Store.Insert(ctx, "cinemas", v)
		}
		return s.Store.Replace(ctx, "cinemas", v.ID, v)
	}) {
		c.JSON(200, v)
	}
}
func (s *Server) listStaff(c *gin.Context) {
	f, ok := scope(c, "cinemaId")
	if !ok {
		return
	}
	search(c, f, "staffCode", "name")
	if status := c.Query("status"); status != "" {
		f["status"] = status
	}
	v := []domain.Staff{}
	s.list(c, "staff", f, bson.D{{Key: "staffCode", Value: 1}}, &v)
}
func (s *Server) saveStaff(c *gin.Context) {
	var v domain.Staff
	if !decode(c, &v) {
		return
	}
	p := auth.Current(c)
	v.Name = strings.TrimSpace(v.Name)
	v.StaffCode = strings.ToUpper(strings.TrimSpace(v.StaffCode))
	if !p.Global() {
		if v.CinemaID != "" && v.CinemaID != p.CinemaID {
			fail(c, 403, "Permission denied")
			return
		}
		v.CinemaID = p.CinemaID
	}
	if !domain.ValidName(v.Name) || len(v.StaffCode) < 2 || len(v.StaffCode) > 50 || !domain.ValidStatus(v.Status) {
		fail(c, 422, "Staff code, name and valid status required")
		return
	}
	var ci domain.Cinema
	if e := s.Store.Get(c.Request.Context(), "cinemas", bson.M{"_id": v.CinemaID, "status": "ACTIVE"}, &ci); e != nil {
		fail(c, 422, "Active cinema required")
		return
	}
	v.ManagerID = strings.TrimSpace(v.ManagerID)
	if v.ManagerID != "" {
		if s.Users == nil {
			fail(c, 503, "Dịch vụ quản lý tài khoản chưa được cấu hình")
			return
		}
		manager, err := s.Users.Get(c.Request.Context(), v.ManagerID)
		if errors.Is(err, auth.ErrNotFound) {
			fail(c, 422, "Tài khoản quản lý không còn tồn tại. Chọn quản lý khác hoặc bỏ gán.")
			return
		}
		if err != nil {
			fail(c, 502, "Không xác minh được quản lý trực tiếp")
			return
		}
		if !eligibleManager(manager, v.CinemaID) {
			fail(c, 422, "Chọn quản lý đang hoạt động cùng rạp")
			return
		}
	}
	v.UpdatedAt = time.Now().UTC()
	v.ID = c.Param("id")
	action := "CREATE_STAFF"
	if v.ID == "" {
		v.ID = domain.ID()
		v.CreatedAt = v.UpdatedAt
	} else {
		old, ok := s.staff(c, v.ID)
		if !ok {
			return
		}
		v.CreatedAt = old.CreatedAt
		action = "UPDATE_STAFF"
		if v.Status == "INACTIVE" && old.Status != "INACTIVE" {
			action = "DISABLE_STAFF"
		}
	}
	if s.mutate(c, action, v.ID, v.CinemaID, func(ctx context.Context) error {
		if action == "CREATE_STAFF" {
			return s.Store.Insert(ctx, "staff", v)
		}
		return s.Store.Replace(ctx, "staff", v.ID, v)
	}) {
		c.JSON(200, v)
	}
}
func (s *Server) adminConfig(c *gin.Context) {
	if !requireGlobal(c) {
		return
	}
	v, e := s.config(c.Request.Context())
	if e != nil {
		dbError(c, e)
		return
	}
	c.JSON(200, v)
}
func (s *Server) saveConfig(c *gin.Context) {
	if !requireGlobal(c) {
		return
	}
	var v domain.FeedbackConfig
	if !decode(c, &v) {
		return
	}
	if e := domain.ValidateConfig(v); e != nil {
		fail(c, 422, e.Error())
		return
	}
	v.ID = "default"
	v.Reasons = nil
	if s.mutate(c, "UPDATE_FEEDBACK_CONFIG", "default", "", func(ctx context.Context) error { return s.Store.Replace(ctx, "feedback_config", "default", v) }) {
		c.JSON(200, v)
	}
}
func (s *Server) listReasons(c *gin.Context) {
	if !requireGlobal(c) {
		return
	}
	v := []domain.Reason{}
	if e := s.Store.List(c.Request.Context(), "feedback_reasons", bson.M{}, bson.D{{Key: "order", Value: 1}}, 0, 0, &v); e != nil {
		dbError(c, e)
		return
	}
	c.JSON(200, v)
}
func (s *Server) saveReason(c *gin.Context) {
	if !requireGlobal(c) {
		return
	}
	var v domain.Reason
	if !decode(c, &v) {
		return
	}
	if e := domain.ValidateReason(v); e != nil {
		fail(c, 422, e.Error())
		return
	}
	v.ID = c.Param("id")
	create := v.ID == ""
	if create {
		v.ID = domain.ID()
	}
	if s.mutate(c, "UPDATE_FEEDBACK_REASON", v.Code, "", func(ctx context.Context) error {
		if create {
			return s.Store.Insert(ctx, "feedback_reasons", v)
		}
		return s.Store.Replace(ctx, "feedback_reasons", v.ID, v)
	}) {
		c.JSON(200, v)
	}
}
func (s *Server) listCoaching(c *gin.Context) {
	f, ok := scope(c, "cinemaId")
	if !ok {
		return
	}
	if status := c.Query("status"); status != "" {
		f["status"] = status
	}
	if id := c.Query("staffId"); id != "" {
		f["staffId"] = id
	}
	if c.Query("followUp") == "true" {
		f["status"] = bson.M{"$in": []string{"OPEN", "IN_PROGRESS"}}
		f["followUpDate"] = bson.M{"$lte": time.Now().In(time.FixedZone("ICT", 7*3600)).Format("2006-01-02")}
	}
	v := []domain.Coaching{}
	s.list(c, "coaching", f, bson.D{{Key: "followUpDate", Value: 1}}, &v)
}
func (s *Server) coachingDetail(c *gin.Context) {
	var v domain.Coaching
	e := s.Store.Get(c.Request.Context(), "coaching", bson.M{"_id": c.Param("id")}, &v)
	if e != nil {
		dbError(c, e)
		return
	}
	if !auth.Current(c).CanCinema(v.CinemaID) {
		fail(c, 403, "Permission denied")
		return
	}
	c.JSON(200, v)
}
func (s *Server) saveCoaching(c *gin.Context) {
	var v domain.Coaching
	if !decode(c, &v) {
		return
	}
	st, ok := s.staff(c, v.StaffID)
	if !ok {
		return
	}
	v.CinemaID = st.CinemaID
	if len(strings.TrimSpace(v.Topic)) < 2 || len(v.Topic) > 200 || len(strings.TrimSpace(v.Action)) < 2 || len(v.Action) > 2000 || len(v.Note) > 4000 {
		fail(c, 422, "Topic and action required")
		return
	}
	if _, e := time.Parse("2006-01-02", v.FollowUpDate); e != nil {
		fail(c, 422, "Follow-up date required")
		return
	}
	v.ID = c.Param("id")
	v.UpdatedAt = time.Now().UTC()
	action := "CREATE_COACHING"
	if v.ID == "" {
		v.ID = domain.ID()
		v.Status = "OPEN"
		v.CreatedBy = auth.Current(c).Name
		v.CreatedAt = v.UpdatedAt
		v.CompletedAt = nil
	} else {
		var old domain.Coaching
		if e := s.Store.Get(c.Request.Context(), "coaching", bson.M{"_id": v.ID}, &old); e != nil {
			dbError(c, e)
			return
		}
		if !auth.Current(c).CanCinema(old.CinemaID) || old.StaffID != v.StaffID {
			fail(c, 403, "Permission denied")
			return
		}
		if v.Status != "OPEN" && v.Status != "IN_PROGRESS" && v.Status != "COMPLETED" && v.Status != "CANCELLED" {
			fail(c, 422, "Invalid coaching status")
			return
		}
		if (old.Status == "COMPLETED" || old.Status == "CANCELLED") && v.Status != old.Status {
			fail(c, 422, "Closed coaching cannot be reopened")
			return
		}
		if old.Status == "IN_PROGRESS" && v.Status == "OPEN" {
			fail(c, 422, "Invalid coaching transition")
			return
		}
		v.CreatedBy = old.CreatedBy
		v.CreatedAt = old.CreatedAt
		v.CompletedAt = old.CompletedAt
		action = "UPDATE_COACHING"
		if v.Status == "COMPLETED" && old.Status != "COMPLETED" {
			v.CompletedAt = &v.UpdatedAt
			action = "COMPLETE_COACHING"
		}
	}
	if s.mutate(c, action, v.ID, v.CinemaID, func(ctx context.Context) error {
		if action == "CREATE_COACHING" {
			return s.Store.Insert(ctx, "coaching", v)
		}
		return s.Store.Replace(ctx, "coaching", v.ID, v)
	}) {
		c.JSON(200, v)
	}
}
func (s *Server) listAudit(c *gin.Context) {
	f, ok := scope(c, "cinemaId")
	if !ok {
		return
	}
	if !dateFilter(c, f) {
		return
	}
	v := []domain.Audit{}
	s.list(c, "audit_logs", f, bson.D{{Key: "createdAt", Value: -1}}, &v)
}
