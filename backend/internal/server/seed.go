package server

import (
	"context"
	"errors"
	"fmt"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"smartcinema/internal/domain"
	"time"
)

func (s *Server) Seed(ctx context.Context, development bool) error {
	var cfg domain.FeedbackConfig
	e := s.Store.Get(ctx, "feedback_config", bson.M{"_id": "default"}, &cfg)
	if errors.Is(e, mongo.ErrNoDocuments) {
		cfg = domain.FeedbackConfig{ID: "default", RatingType: "ICON+TEXT", ConsentVersion: "v1", MinimumFeedbackForRanking: 20, RatingOptions: []domain.Rating{{Value: 1, Label: "Rất không hài lòng", English: "Very unhappy", Icon: "smiley-angry", Enabled: true}, {Value: 2, Label: "Không hài lòng", English: "Unhappy", Icon: "smiley-sad", Enabled: true}, {Value: 3, Label: "Bình thường", English: "Neutral", Icon: "smiley-meh", Enabled: true}, {Value: 4, Label: "Hài lòng", English: "Happy", Icon: "smiley", Enabled: true}, {Value: 5, Label: "Rất hài lòng", English: "Delighted", Icon: "smiley-wink", Enabled: true}}}
		if e = s.Store.Insert(ctx, "feedback_config", cfg); e != nil && !mongo.IsDuplicateKeyError(e) {
			return e
		}
	} else if e != nil {
		return e
	}
	reasons := []domain.Reason{
		{ID: "FRIENDLY", Code: "FRIENDLY", Label: "Thân thiện", English: "Friendly", Type: "POSITIVE", Ratings: []int{4, 5}, Status: "ACTIVE", Order: 1},
		{ID: "CLEAR", Code: "CLEAR", Label: "Tư vấn rõ ràng", English: "Clear advice", Type: "POSITIVE", Ratings: []int{4, 5}, Status: "ACTIVE", Order: 2},
		{ID: "FAST", Code: "FAST", Label: "Phục vụ nhanh", English: "Fast service", Type: "POSITIVE", Ratings: []int{4, 5}, Status: "ACTIVE", Order: 3},
		{ID: "WAIT", Code: "WAIT", Label: "Thời gian chờ lâu", English: "Long wait", Type: "NEGATIVE", Ratings: []int{1, 2, 3}, Status: "ACTIVE", Order: 4},
		{ID: "CONSULTING", Code: "CONSULTING", Label: "Tư vấn chưa rõ", English: "Unclear advice", Type: "NEGATIVE", Ratings: []int{1, 2, 3}, Status: "ACTIVE", Order: 5},
		{ID: "ATTITUDE", Code: "ATTITUDE", Label: "Thái độ phục vụ", English: "Service attitude", Type: "NEGATIVE", Ratings: []int{1, 2}, Required: true, Status: "ACTIVE", Order: 6},
		{ID: "PAYMENT", Code: "PAYMENT", Label: "Thanh toán", English: "Payment", Type: "BOTH", Ratings: []int{1, 2, 3, 4, 5}, Status: "DISABLED", Order: 7},
		{ID: "OTHER", Code: "OTHER", Label: "Khác", English: "Other", Type: "BOTH", Ratings: []int{1, 2, 3, 4, 5}, Status: "ACTIVE", Order: 8},
	}
	for _, r := range reasons {
		var existing domain.Reason
		e = s.Store.Get(ctx, "feedback_reasons", bson.M{"_id": r.ID}, &existing)
		if errors.Is(e, mongo.ErrNoDocuments) {
			if e = s.Store.Insert(ctx, "feedback_reasons", r); e != nil && !mongo.IsDuplicateKeyError(e) {
				return e
			}
		} else if e != nil {
			return e
		}
	}
	if !development {
		return nil
	}
	n, e := s.Store.Count(ctx, "cinemas", bson.M{})
	if e != nil || n > 0 {
		return e
	}
	return s.Store.Transaction(ctx, func(ctx context.Context) error {
		now := time.Now().UTC()
		cinemas := []domain.Cinema{{ID: "cinema-gnd", Code: "GND", Name: "Galaxy Nguyễn Du", Status: "ACTIVE", CreatedAt: now, UpdatedAt: now}, {ID: "cinema-gbt", Code: "GBT", Name: "Galaxy Bình Tân", Status: "ACTIVE", CreatedAt: now, UpdatedAt: now}}
		for _, ci := range cinemas {
			if e := s.Store.Insert(ctx, "cinemas", ci); e != nil {
				return e
			}
			for i := 1; i <= 4; i++ {
				st := domain.Staff{ID: fmt.Sprintf("%s-staff-%d", ci.ID, i), StaffCode: fmt.Sprintf("%s%03d", ci.Code, i), Name: fmt.Sprintf("Nhân viên thử nghiệm %d", i), CinemaID: ci.ID, Status: "ACTIVE", CreatedAt: now, UpdatedAt: now}
				if e := s.Store.Insert(ctx, "staff", st); e != nil {
					return e
				}
				q := domain.QR{ID: domain.ID(), StaffID: st.ID, CinemaID: ci.ID, PublicToken: domain.ID(), Status: "ACTIVE", CreatedBy: "development-seed", CreatedAt: now, UpdatedAt: now}
				if e := s.Store.Insert(ctx, "staff_qr_codes", q); e != nil {
					return e
				}
				count := 35
				if i == 4 {
					count = 3
				}
				for j := 0; j < count; j++ {
					rating := 5
					if j%7 == 0 {
						rating = 2
					} else if j%5 == 0 {
						rating = 3
					} else if j%3 == 0 {
						rating = 4
					}
					created := now.Add(-time.Duration(j*9+i) * time.Hour)
					f := domain.Feedback{ID: domain.ID(), Staff: domain.Snapshot{ID: st.ID, Code: st.StaffCode, Name: st.Name}, Cinema: domain.Snapshot{ID: ci.ID, Code: ci.Code, Name: ci.Name}, Customer: domain.Customer{Name: fmt.Sprintf("Khách thử nghiệm %d", j+1), Phone: "84900000000"}, Rating: cfg.RatingOptions[rating-1], Reasons: []domain.Reason{reasons[0]}, Comment: "Dữ liệu giả lập phục vụ kiểm thử.", CreatedAt: created}
					if rating <= 3 {
						f.Reasons = []domain.Reason{reasons[3]}
						if rating <= 2 {
							f.Reasons = append(f.Reasons, reasons[5])
						}
					}
					f.QR.ID = q.ID
					f.QR.Token = q.PublicToken
					f.Consent.Accepted = true
					f.Consent.Version = "v1"
					f.Consent.AcceptedAt = created
					f.Metadata.IPHash = s.hash("seed")
					f.Metadata.Suspicious = j%19 == 0
					if e := s.Store.Insert(ctx, "feedbacks", f); e != nil {
						return e
					}
				}
			}
		}
		return nil
	})
}
