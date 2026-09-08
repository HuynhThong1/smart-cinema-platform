package domain

import "time"

type Cinema struct {
	ID        string    `json:"id" bson:"_id"`
	Code      string    `json:"code" bson:"code"`
	Name      string    `json:"name" bson:"name"`
	Status    string    `json:"status" bson:"status"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" bson:"updatedAt"`
}
type Staff struct {
	ManagerID string    `json:"managerId" bson:"managerId"`
	ID        string    `json:"id" bson:"_id"`
	StaffCode string    `json:"staffCode" bson:"staffCode"`
	Name      string    `json:"name" bson:"name"`
	CinemaID  string    `json:"cinemaId" bson:"cinemaId"`
	Status    string    `json:"status" bson:"status"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" bson:"updatedAt"`
}
type QR struct {
	FeedbackRevision int64     `json:"-" bson:"feedbackRevision"`
	ID               string    `json:"id" bson:"_id"`
	StaffID          string    `json:"staffId" bson:"staffId"`
	CinemaID         string    `json:"cinemaId" bson:"cinemaId"`
	PublicToken      string    `json:"publicToken" bson:"publicToken"`
	Status           string    `json:"status" bson:"status"`
	CreatedBy        string    `json:"createdBy" bson:"createdBy"`
	CreatedAt        time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt" bson:"updatedAt"`
}
type Snapshot struct {
	ID   string `json:"id" bson:"id"`
	Code string `json:"code" bson:"code"`
	Name string `json:"name" bson:"name"`
}
type Rating struct {
	Value   int    `json:"value" bson:"value"`
	Label   string `json:"label" bson:"label"`
	English string `json:"english" bson:"english"`
	Icon    string `json:"icon" bson:"icon"`
	Enabled bool   `json:"enabled" bson:"enabled"`
}
type Reason struct {
	ID       string `json:"id" bson:"_id"`
	Code     string `json:"code" bson:"code"`
	Label    string `json:"label" bson:"label"`
	English  string `json:"english" bson:"english"`
	Type     string `json:"type" bson:"type"`
	Ratings  []int  `json:"ratings" bson:"ratings"`
	Required bool   `json:"required" bson:"required"`
	Status   string `json:"status" bson:"status"`
	Order    int    `json:"order" bson:"order"`
}
type FeedbackConfig struct {
	ID                        string   `json:"id" bson:"_id"`
	RatingType                string   `json:"ratingType" bson:"ratingType"`
	RatingOptions             []Rating `json:"ratingOptions" bson:"ratingOptions"`
	MinimumFeedbackForRanking int      `json:"minimumFeedbackForRanking" bson:"minimumFeedbackForRanking"`
	ConsentVersion            string   `json:"consentVersion" bson:"consentVersion"`
	Reasons                   []Reason `json:"reasons" bson:"-"`
}
type Customer struct {
	Name  string `json:"name" bson:"name"`
	Phone string `json:"phone" bson:"phone"`
}
type Feedback struct {
	TransactionID       string `json:"transactionId" bson:"transactionId"`
	TransactionSource   string `json:"transactionSource" bson:"transactionSource"`
	TransactionVerified bool   `json:"transactionVerified" bson:"transactionVerified"`

	ID       string   `json:"id" bson:"_id"`
	Staff    Snapshot `json:"staff" bson:"staff"`
	Cinema   Snapshot `json:"cinema" bson:"cinema"`
	Customer Customer `json:"customer" bson:"customer"`
	Rating   Rating   `json:"rating" bson:"rating"`
	Reasons  []Reason `json:"reasons" bson:"reasons"`
	Comment  string   `json:"comment" bson:"comment"`
	QR       struct {
		ID    string `json:"id" bson:"id"`
		Token string `json:"token" bson:"token"`
	} `json:"qr" bson:"qr"`
	Metadata struct {
		IPHash     string `json:"ipHash" bson:"ipHash"`
		UserAgent  string `json:"userAgent" bson:"userAgent"`
		Suspicious bool   `json:"suspicious" bson:"suspicious"`
	} `json:"metadata" bson:"metadata"`
	Consent struct {
		Accepted   bool      `json:"accepted" bson:"accepted"`
		Version    string    `json:"version" bson:"version"`
		AcceptedAt time.Time `json:"acceptedAt" bson:"acceptedAt"`
	} `json:"consent" bson:"consent"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
}
type Coaching struct {
	ID           string     `json:"id" bson:"_id"`
	StaffID      string     `json:"staffId" bson:"staffId"`
	CinemaID     string     `json:"cinemaId" bson:"cinemaId"`
	Topic        string     `json:"topic" bson:"topic"`
	Action       string     `json:"action" bson:"action"`
	Note         string     `json:"note" bson:"note"`
	Status       string     `json:"status" bson:"status"`
	CreatedBy    string     `json:"createdBy" bson:"createdBy"`
	CreatedAt    time.Time  `json:"createdAt" bson:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt" bson:"updatedAt"`
	FollowUpDate string     `json:"followUpDate" bson:"followUpDate"`
	CompletedAt  *time.Time `json:"completedAt" bson:"completedAt"`
}
type Audit struct {
	ID        string    `json:"id" bson:"_id"`
	Actor     string    `json:"actor" bson:"actor"`
	Action    string    `json:"action" bson:"action"`
	Target    string    `json:"target" bson:"target"`
	CinemaID  string    `json:"cinemaId" bson:"cinemaId"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
}
