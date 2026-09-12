package domain

import "testing"

func TestNormalizeTransaction(t *testing.T) {
	for _, tc := range []struct{ id, source, want, wantSource string }{
		{" 01313035/0002 ", "QR_SCAN", "01313035", "QR_SCAN"},
		{"123456/123", "QR_TICKET", "123456", "QR_TICKET"},
		{"1234567890/12345", "MANUAL", "1234567890", "MANUAL"},
		{"01313035/0002", "verified", "01313035", "MANUAL"},
		{"01313035", "MANUAL", "01313035", "MANUAL"},
		{"01313035/0003", "QR_SCAN", "01313035", "QR_SCAN"},
		{"", "QR_SCAN", "", "NONE"},
		{"12345/0002", "MANUAL", "", "NONE"},
		{"01313035/02", "MANUAL", "", "NONE"},
		{"https://example.com/?tx=01313035/0002", "QR_SCAN", "", "NONE"},
		{"01313035/0002\nextra", "MANUAL", "", "NONE"},
	} {
		id, source := NormalizeTransaction(tc.id, tc.source)
		if id != tc.want || source != tc.wantSource {
			t.Fatalf("%q: got %q %q", tc.id, id, source)
		}
	}
}
