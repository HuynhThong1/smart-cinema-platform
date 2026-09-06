package server

import (
	"context"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"net/mail"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"strings"
	"unicode/utf8"
)

func (s *Server) usersReady(c *gin.Context) bool {
	if auth.Current(c).Role != "SYSTEM_ADMIN" {
		fail(c, 403, "Permission denied")
		return false
	}
	if s.Users == nil {
		fail(c, 503, "User administration is not configured")
		return false
	}
	return true
}
func (s *Server) listUsers(c *gin.Context) {
	if !s.usersReady(c) {
		return
	}
	p, n := page(c)
	users, total, e := s.Users.List(c.Request.Context(), c.Query("search"), int((p-1)*n), int(n))
	if e != nil {
		fail(c, 502, "Không tải được người dùng từ dịch vụ đăng nhập")
		return
	}
	c.JSON(200, gin.H{"items": users, "total": total, "page": p, "pageSize": n})
}
func (s *Server) saveUser(c *gin.Context) {
	if !s.usersReady(c) {
		return
	}
	var u auth.User
	if !decode(c, &u) {
		return
	}
	u.ID = c.Param("id")
	u.Username = strings.TrimSpace(u.Username)
	if len(u.Username) < 2 || len(u.Username) > 100 || !domain.ValidName(strings.TrimSpace(u.FirstName+" "+u.LastName)) {
		fail(c, 422, "Username and name required")
		return
	}
	if _, e := mail.ParseAddress(u.Email); e != nil {
		fail(c, 422, "Valid email required")
		return
	}
	if u.Role != "SYSTEM_ADMIN" && u.Role != "HEAD_OFFICE" && u.Role != "CINEMA_MANAGER" {
		fail(c, 422, "Invalid role")
		return
	}
	if u.ID == auth.Current(c).Subject && (!u.Enabled || u.Role != "SYSTEM_ADMIN") {
		fail(c, 422, "Cannot remove your own administrator access")
		return
	}
	if u.ID == "" && utf8.RuneCountInString(u.TemporaryPassword) < 12 {
		fail(c, 422, "Temporary password must have at least 12 characters")
		return
	}
	if u.Role == "CINEMA_MANAGER" {
		var ci domain.Cinema
		if e := s.Store.Get(c.Request.Context(), "cinemas", bson.M{"_id": u.CinemaID, "status": "ACTIVE"}, &ci); e != nil {
			fail(c, 422, "Assign an active cinema")
			return
		}
	} else {
		u.CinemaID = ""
	}
	// Keycloak and MongoDB cannot share a transaction. Record intent before the external action.
	if !s.mutate(c, "UPDATE_USER_REQUESTED", u.Username, u.CinemaID, func(context.Context) error { return nil }) {
		return
	}
	result, e := s.Users.Save(c.Request.Context(), u)
	if e != nil {
		_ = s.mutate(c, "UPDATE_USER_FAILED", u.Username, u.CinemaID, func(context.Context) error { return nil })
		if !c.IsAborted() {
			fail(c, 502, "Không thể hoàn tất cập nhật. Kiểm tra người dùng trước khi thử lại.")
		}
		return
	}
	if s.mutate(c, "UPDATE_USER", result.ID, u.CinemaID, func(context.Context) error { return nil }) {
		c.JSON(200, result)
	}
}

func (s *Server) deleteUser(c *gin.Context) {
	if !s.usersReady(c) {
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		fail(c, 400, "User id required")
		return
	}
	if id == auth.Current(c).Subject {
		fail(c, 422, "Cannot delete your own account")
		return
	}
	// Record intent before deleting the external Keycloak account.
	if !s.mutate(c, "DELETE_USER_REQUESTED", id, "", func(context.Context) error { return nil }) {
		return
	}
	if e := s.Users.Delete(c.Request.Context(), id); e != nil {
		_ = s.mutate(c, "DELETE_USER_FAILED", id, "", func(context.Context) error { return nil })
		if !c.IsAborted() {
			fail(c, 502, "Không thể xóa người dùng. Kiểm tra tài khoản trước khi thử lại.")
		}
		return
	}
	if s.mutate(c, "DELETE_USER", id, "", func(context.Context) error { return nil }) {
		c.Status(204)
	}
}
