package server

import (
	"context"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"log/slog"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"time"
)

func eligibleManager(u auth.User, cinema string) bool {
	return u.Enabled && u.Role == "CINEMA_MANAGER" && u.CinemaID == cinema
}

// detachManager clears staff.managerId wherever the account can no longer read
// the notifications it would receive. Without it a deleted or reassigned manager
// leaves links that block staff edits and route new notifications to a reader
// who is out of scope for them. Pass a user carrying only ID (a deleted account)
// to detach every link to it.
func (s *Server) detachManager(ctx context.Context, u auth.User) {
	if u.ID == "" {
		return
	}
	f := bson.M{"managerId": u.ID}
	if u.Enabled && u.Role == "CINEMA_MANAGER" && u.CinemaID != "" {
		f["cinemaId"] = bson.M{"$ne": u.CinemaID}
	}
	n, err := s.Store.Update(ctx, "staff", f, bson.M{"$set": bson.M{"managerId": ""}})
	if err != nil {
		slog.Error("could not detach stale manager links", "managerId", u.ID)
		return
	}
	if n > 0 {
		slog.Info("detached stale manager links", "managerId", u.ID, "staff", n)
	}
}
func (s *Server) listManagers(c *gin.Context) {
	cinema := c.Query("cinemaId")
	if cinema == "" || !auth.Current(c).CanCinema(cinema) {
		fail(c, 403, "Permission denied")
		return
	}
	if s.Users == nil {
		fail(c, 503, "Dịch vụ quản lý tài khoản chưa được cấu hình")
		return
	}
	users, err := s.Users.Managers(c.Request.Context(), cinema)
	if err != nil {
		fail(c, 502, "Không tải được danh sách quản lý")
		return
	}
	// Return only selection data, never account credentials or email addresses.
	items := []gin.H{}
	for _, u := range users {
		items = append(items, gin.H{"id": u.ID, "name": u.FirstName + " " + u.LastName})
	}
	c.JSON(200, items)
}
func (s *Server) queueFeedbackNotification(ctx context.Context, st domain.Staff, f domain.Feedback) error {
	if st.ManagerID == "" {
		return nil
	}
	n := domain.Notification{ID: f.ID, RecipientID: st.ManagerID, CinemaID: f.Cinema.ID, FeedbackID: f.ID, StaffName: f.Staff.Name, Rating: f.Rating.Value, Suspicious: f.Metadata.Suspicious, CreatedAt: f.CreatedAt}
	if err := s.Store.Insert(ctx, "notifications", n); err != nil {
		return err
	}
	// With no worker running the job could only ever expire unsent, so skip it
	// rather than growing a backlog the worker would have to walk once enabled.
	if !s.EmailEnabled {
		return nil
	}
	return s.Store.Insert(ctx, "notification_emails", domain.EmailJob{ID: n.ID, Notification: n, Status: "pending", NextAttemptAt: n.CreatedAt})
}
func notificationScope(c *gin.Context) bson.M {
	p := auth.Current(c)
	f := bson.M{"recipientId": p.Subject}
	if !p.Global() {
		f["cinemaId"] = p.CinemaID
	}
	return f
}
func (s *Server) listNotifications(c *gin.Context) {
	f := notificationScope(c)
	if c.Query("unread") == "true" {
		f["readAt"] = nil
	}
	out := []domain.Notification{}
	s.list(c, "notifications", f, bson.D{{Key: "createdAt", Value: -1}, {Key: "_id", Value: 1}}, &out)
}
func (s *Server) unreadNotifications(c *gin.Context) {
	f := notificationScope(c)
	f["readAt"] = nil
	count, err := s.Store.Count(c.Request.Context(), "notifications", f)
	if err != nil {
		dbError(c, err)
		return
	}
	c.JSON(200, gin.H{"count": count})
}

// readAllNotifications clears the whole unread queue in one write. Looping the
// per-id endpoint from the client would leave the inbox half-read whenever a
// request in the middle of the batch failed.
func (s *Server) readAllNotifications(c *gin.Context) {
	f := notificationScope(c)
	f["readAt"] = nil
	n, err := s.Store.Update(c.Request.Context(), "notifications", f, bson.M{"$set": bson.M{"readAt": time.Now().UTC()}})
	if err != nil {
		dbError(c, err)
		return
	}
	c.JSON(200, gin.H{"updated": n})
}
func (s *Server) readNotification(c *gin.Context) {
	f := notificationScope(c)
	f["_id"] = c.Param("id")
	err := s.Store.Transaction(c.Request.Context(), func(ctx context.Context) error {
		var n domain.Notification
		if err := s.Store.Get(ctx, "notifications", f, &n); err != nil {
			return err
		}
		if n.ReadAt != nil {
			return nil
		}
		now := time.Now().UTC()
		n.ReadAt = &now
		return s.Store.Replace(ctx, "notifications", n.ID, n)
	})
	if err != nil {
		dbError(c, err)
		return
	}
	c.Status(204)
}
