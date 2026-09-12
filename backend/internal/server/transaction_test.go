package server

import (
	"go.mongodb.org/mongo-driver/v2/bson"
	"smartcinema/internal/domain"
	"strings"
	"testing"
)

func TestTransactionFeedbackPersistenceAndDedupe(t *testing.T) {
	f := setup(t)
	for i, staff := range []string{"cinema-gnd-staff-1", "cinema-gnd-staff-2"} {
		status, qr := f.request(t, "POST", "/api/v1/admin/staff/"+staff+"/qr", "manager", map[string]any{})
		mustStatus(t, 200, status, qr)
		body := map[string]any{"qrToken": qr["publicToken"], "rating": 5, "reasons": []string{}, "name": "Synthetic Customer", "phone": []string{"0912345678", "0912345679"}[i], "consent": true, "consentVersion": "v1", "transactionId": []string{"01313035/0002", "01313035/0003"}[i], "transactionSource": "QR_SCAN"}
		status, out := f.request(t, "POST", "/api/v1/public/feedback", "", body)
		mustStatus(t, 201, status, out)
	}
	var records []domain.Feedback
	if err := f.s.Store.List(f.ctx, "feedbacks", bson.M{"transactionId": "01313035"}, bson.D{{Key: "createdAt", Value: 1}}, 0, 0, &records); err != nil {
		t.Fatal(err)
	}
	if len(records) != 2 || records[0].Metadata.Suspicious || !records[1].Metadata.Suspicious {
		t.Fatalf("dedupe: %+v", records)
	}
	for _, r := range records {
		if r.TransactionVerified || r.TransactionSource != "QR_SCAN" {
			t.Fatal("untrusted verification", r)
		}
	}
	status, qr := f.request(t, "POST", "/api/v1/admin/staff/cinema-gnd-staff-1/qr", "manager", map[string]any{})
	mustStatus(t, 200, status, qr)
	status, result := f.request(t, "POST", "/api/v1/public/feedback", "", map[string]any{"qrToken": qr["publicToken"], "rating": 5, "name": "Optional Customer", "phone": "0987654321", "consent": true, "consentVersion": "v1", "transactionId": "malformed", "transactionSource": "QR_SCAN"})
	mustStatus(t, 201, status, result)
	var optional domain.Feedback
	if err := f.s.Store.Get(f.ctx, "feedbacks", bson.M{"customer.name": "Optional Customer"}, &optional); err != nil {
		t.Fatal(err)
	}
	if optional.TransactionID != "" || optional.TransactionSource != "NONE" || optional.TransactionVerified {
		t.Fatal(optional)
	}
	for _, path := range []string{"/api/v1/public/transaction/01313035/0002", "/api/v1/public/transaction/01313035%2F0002"} {
		status, out := f.request(t, "GET", path, "", nil)
		mustStatus(t, 200, status, out)
		if out["transactionId"] != "01313035" || out["verified"] != false || len(out) != 2 {
			t.Fatal("unsafe lookup", out)
		}
	}
	// Existing feedbacks may still contain the old quantity suffix.
	if _, err := f.s.Store.Update(f.ctx, "feedbacks", bson.M{"_id": records[0].ID}, bson.M{"$set": bson.M{"transactionId": "01313035/0002"}}); err != nil {
		t.Fatal(err)
	}
	status, detail := f.request(t, "GET", "/api/v1/admin/feedbacks/"+records[0].ID, "manager", nil)
	mustStatus(t, 200, status, detail)
	if detail["transactionId"] != "01313035" {
		t.Fatal(detail)
	}
	status, out := f.request(t, "GET", "/api/v1/admin/feedbacks?hasTransaction=true&includeSuspicious=true", "manager", nil)
	mustStatus(t, 200, status, out)
	for _, item := range out["items"].([]any) {
		if strings.Contains(item.(map[string]any)["transactionId"].(string), "/") {
			t.Fatal(item)
		}
	}
	if out["total"] != float64(2) {
		t.Fatal(out)
	}
	status, out = f.request(t, "GET", "/api/v1/admin/feedbacks?hasTransaction=invalid", "manager", nil)
	mustStatus(t, 400, status, out)
}

func TestTransactionLookupSharesPostQuota(t *testing.T) {
	f := setup(t)
	for i := 0; i < 20; i++ {
		status, out := f.request(t, "GET", "/api/v1/public/transaction/00000001/0001", "", nil)
		mustStatus(t, 200, status, out)
	}
	status, out := f.request(t, "POST", "/api/v1/public/feedback", "", map[string]any{})
	mustStatus(t, 429, status, out)
}
