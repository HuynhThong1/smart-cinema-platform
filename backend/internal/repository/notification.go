package repository

import (
	"context"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"smartcinema/internal/domain"
	"time"
)

// ClaimEmail atomically leases one job across API replicas. A crashed worker's
// job becomes eligible again after the lease expires.
func (m *Mongo) ClaimEmail(ctx context.Context) (domain.EmailJob, error) {
	now := time.Now().UTC()
	var job domain.EmailJob
	err := m.DB.Collection("notification_emails").FindOneAndUpdate(ctx,
		bson.M{"status": bson.M{"$in": bson.A{"pending", "sending"}}, "nextAttemptAt": bson.M{"$lte": now}},
		bson.M{"$set": bson.M{"status": "sending", "lease": domain.ID(), "nextAttemptAt": now.Add(2 * time.Minute)}, "$inc": bson.M{"attempts": 1}},
		options.FindOneAndUpdate().SetSort(bson.D{{Key: "nextAttemptAt", Value: 1}}).SetReturnDocument(options.After)).Decode(&job)
	return job, err
}
func (m *Mongo) FinishEmail(ctx context.Context, job domain.EmailJob, status, reason string, next time.Time) error {
	_, err := m.DB.Collection("notification_emails").UpdateOne(ctx, bson.M{"_id": job.ID, "lease": job.Lease, "status": "sending"}, bson.M{"$set": bson.M{"status": status, "lastError": reason, "nextAttemptAt": next}, "$unset": bson.M{"lease": ""}})
	return err
}
