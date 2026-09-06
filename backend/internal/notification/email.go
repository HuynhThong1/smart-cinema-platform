package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"io"
	"log/slog"
	"net/http"
	"net/mail"
	"net/url"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"strings"
	"time"
)

// ErrPermanent marks a rejection that would fail identically on every retry, so
// the job is abandoned instead of burning the whole backoff schedule.
var ErrPermanent = errors.New("permanent delivery failure")

type Queue interface {
	ClaimEmail(context.Context) (domain.EmailJob, error)
	FinishEmail(context.Context, domain.EmailJob, string, string, time.Time) error
}
type Directory interface {
	Get(context.Context, string) (auth.User, error)
}
type Sender interface {
	Send(context.Context, string, domain.Notification) error
}
type Resend struct {
	Key, From, AdminURL string
	Client              *http.Client
}

func (r Resend) Validate() error {
	u, err := url.Parse(r.AdminURL)
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return errors.New("valid ADMIN_URL required")
	}
	if _, err := mail.ParseAddress(r.From); err != nil {
		return errors.New("valid NOTIFICATION_EMAIL_FROM required")
	}
	if r.Key == "" {
		return errors.New("RESEND_API_KEY required")
	}
	return nil
}
func (r Resend) Send(ctx context.Context, to string, n domain.Notification) error {
	subject := "Có đánh giá mới từ khách hàng"
	if n.Rating <= 2 {
		subject = "Cần xử lý: khách hàng đánh giá thấp"
	}
	text := fmt.Sprintf("%s\nNhân viên: %s\nĐiểm: %d/5\nThời gian: %s\nXem feedback và xử lý: %s/feedback?feedbackId=%s\n", subject, n.StaffName, n.Rating, n.CreatedAt.Format(time.RFC3339), strings.TrimRight(r.AdminURL, "/"), url.QueryEscape(n.FeedbackID))
	if n.Suspicious {
		text += "Lưu ý: đánh giá được đánh dấu nghi vấn.\n"
	}
	body, err := json.Marshal(map[string]any{"from": r.From, "to": []string{to}, "subject": subject, "text": text})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "feedback/"+n.ID)
	client := r.Client
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	res, err := client.Do(req)
	if err != nil {
		return errors.New("email transport failed")
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 4096))
	// 429 is the one 4xx worth retrying; the rest mean a bad key, an unverified
	// sender or a malformed payload, none of which a later attempt can change.
	if res.StatusCode >= 400 && res.StatusCode < 500 && res.StatusCode != http.StatusTooManyRequests {
		return fmt.Errorf("%w: email provider status %d", ErrPermanent, res.StatusCode)
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("email provider status %d", res.StatusCode)
	}
	return nil
}

// DeliverOne keeps all network operations outside feedback transactions. No
// customer PII is sent. Revalidate account/scope before every delivery attempt.
func DeliverOne(ctx context.Context, q Queue, users Directory, sender Sender) (bool, error) {
	job, err := q.ClaimEmail(ctx)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	now := time.Now().UTC()
	finish := func(status, reason string, next time.Time) (bool, error) {
		return true, q.FinishEmail(ctx, job, status, reason, next)
	}
	// Stay inside the provider's 24-hour idempotency window, even after downtime.
	if job.Attempts > 8 || now.Sub(job.Notification.CreatedAt) > 12*time.Hour {
		return finish("failed", "retry window exhausted", now)
	}
	attemptCtx, cancel := context.WithTimeout(ctx, 40*time.Second)
	defer cancel()
	u, err := users.Get(attemptCtx, job.Notification.RecipientID)
	if errors.Is(err, auth.ErrNotFound) {
		return finish("cancelled", "recipient account no longer exists", now)
	}
	if err == nil {
		if !u.Enabled || u.Role != "CINEMA_MANAGER" || u.CinemaID != job.Notification.CinemaID {
			return finish("cancelled", "recipient no longer eligible", now)
		}
		address, e := mail.ParseAddress(u.Email)
		if e != nil {
			return finish("failed", "recipient email missing or invalid", now)
		}
		err = sender.Send(attemptCtx, address.Address, job.Notification)
	}
	if err == nil {
		return finish("sent", "", now)
	}
	status := "pending"
	if job.Attempts >= 8 || errors.Is(err, ErrPermanent) {
		status = "failed"
	}
	// Persist only a generic failure code, never provider response or credentials.
	slog.Warn("notification email attempt failed", "jobId", job.ID, "attempt", job.Attempts)
	return finish(status, "delivery failed", now.Add(time.Duration(1<<min(job.Attempts, 7))*time.Minute))
}
func Run(ctx context.Context, q Queue, users Directory, sender Sender) {
	for ctx.Err() == nil {
		worked, err := DeliverOne(ctx, q, users, sender)
		if err != nil {
			slog.Error("notification queue operation failed")
		}
		delay := time.Second
		if !worked || err != nil {
			delay = 5 * time.Second
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
	}
}
