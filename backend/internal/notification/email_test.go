package notification

import (
	"context"
	"errors"
	"io"
	"net/http"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"strings"
	"testing"
	"time"
)

type fakeQueue struct {
	job    domain.EmailJob
	status string
	next   time.Time
}

func (q *fakeQueue) ClaimEmail(context.Context) (domain.EmailJob, error) { return q.job, nil }
func (q *fakeQueue) FinishEmail(_ context.Context, _ domain.EmailJob, status, reason string, next time.Time) error {
	q.status = status
	q.next = next
	return nil
}

type fakeDirectory struct {
	user auth.User
	err  error
}

func (d fakeDirectory) Get(context.Context, string) (auth.User, error) { return d.user, d.err }

type fakeSender struct {
	calls int
	err   error
}

func (s *fakeSender) Send(context.Context, string, domain.Notification) error {
	s.calls++
	return s.err
}
func TestDeliverySafetyAndRetries(t *testing.T) {
	for _, tc := range []struct {
		name, role, cinema, status string
		enabled                    bool
		attempts                   int
		age                        time.Duration
		lookupErr, sendErr         error
		calls                      int
	}{
		{name: "sent", role: "CINEMA_MANAGER", cinema: "a", enabled: true, attempts: 1, status: "sent", calls: 1},
		{name: "disabled", role: "CINEMA_MANAGER", cinema: "a", status: "cancelled"},
		{name: "cross cinema", role: "CINEMA_MANAGER", cinema: "b", enabled: true, status: "cancelled"},
		{name: "role revoked", role: "HEAD_OFFICE", cinema: "a", enabled: true, status: "cancelled"},
		{name: "directory down", lookupErr: errors.New("down"), status: "pending", attempts: 1},
		{name: "provider down", role: "CINEMA_MANAGER", cinema: "a", enabled: true, attempts: 1, sendErr: errors.New("down"), status: "pending", calls: 1},
		{name: "retry exhausted", role: "CINEMA_MANAGER", cinema: "a", enabled: true, attempts: 8, sendErr: errors.New("down"), status: "failed", calls: 1},
		{name: "old job", age: 13 * time.Hour, status: "failed"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			q := &fakeQueue{job: domain.EmailJob{ID: "f", Attempts: tc.attempts, Notification: domain.Notification{ID: "f", CinemaID: "a", CreatedAt: time.Now().Add(-tc.age)}}}
			d := fakeDirectory{auth.User{Enabled: tc.enabled, Role: tc.role, CinemaID: tc.cinema, Email: "manager@example.test"}, tc.lookupErr}
			s := &fakeSender{err: tc.sendErr}
			worked, err := DeliverOne(context.Background(), q, d, s)
			if !worked || err != nil || q.status != tc.status || s.calls != tc.calls {
				t.Fatalf("worked=%v err=%v status=%s calls=%d", worked, err, q.status, s.calls)
			}
			if q.status == "pending" && !q.next.After(time.Now()) {
				t.Fatal("retry must be delayed")
			}
		})
	}
}

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestResendIdempotencyAndDeepLink(t *testing.T) {
	calls := 0
	sender := Resend{Key: "synthetic", From: "Cinema <alerts@example.test>", AdminURL: "https://admin.example.test", Client: &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.Header.Get("Idempotency-Key") != "feedback/f-1" {
			t.Fatal("missing stable idempotency key")
		}
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), "feedback?feedbackId=f-1") || !strings.Contains(string(body), "Cần xử lý") {
			t.Fatalf("bad payload: %s", body)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"id":"mail-1"}`)), Header: http.Header{}}, nil
	})}}
	if err := sender.Validate(); err != nil {
		t.Fatal(err)
	}
	n := domain.Notification{ID: "f-1", FeedbackID: "f-1", Rating: 1, CreatedAt: time.Now()}
	for range 2 {
		if err := sender.Send(context.Background(), "manager@example.test", n); err != nil {
			t.Fatal(err)
		}
	}
	if calls != 2 {
		t.Fatal(calls)
	}
}
