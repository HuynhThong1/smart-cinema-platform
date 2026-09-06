package domain

import "time"

// Notification contains no customer identity, phone, comment or public QR token.
type Notification struct {
	ID          string     `json:"id" bson:"_id"`
	RecipientID string     `json:"-" bson:"recipientId"`
	CinemaID    string     `json:"cinemaId" bson:"cinemaId"`
	FeedbackID  string     `json:"feedbackId" bson:"feedbackId"`
	StaffName   string     `json:"staffName" bson:"staffName"`
	Rating      int        `json:"rating" bson:"rating"`
	Suspicious  bool       `json:"suspicious" bson:"suspicious"`
	CreatedAt   time.Time  `json:"createdAt" bson:"createdAt"`
	ReadAt      *time.Time `json:"readAt" bson:"readAt"`
}

type EmailJob struct {
	ID            string       `bson:"_id"`
	Notification  Notification `bson:"notification"`
	Status        string       `bson:"status"`
	Attempts      int          `bson:"attempts"`
	NextAttemptAt time.Time    `bson:"nextAttemptAt"`
	Lease         string       `bson:"lease"`
	LastError     string       `bson:"lastError"`
}
