package domain

import "testing"

func TestNormalizePhone(t *testing.T) {
	for _, raw := range []string{"0912345678", "+84912345678", "84 912 345 678", "(0912) 345-678"} {
		got, err := NormalizePhone(raw)
		if err != nil || got != "84912345678" {
			t.Errorf("NormalizePhone(%q)=%q, %v", raw, got, err)
		}
	}
	for _, raw := range []string{"abc0912345678", "+10912345678", "09123", "849123456789", "++84912345678"} {
		if _, e := NormalizePhone(raw); e == nil {
			t.Errorf("accepted invalid phone %q", raw)
		}
	}
}
func TestTokensAreOpaqueAndUnique(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		v := ID()
		if len(v) != 32 || seen[v] {
			t.Fatal("unexpected token collision or size")
		}
		seen[v] = true
	}
}
func TestVietnameseNameLength(t *testing.T) {
	if !ValidName("  Á Â  ") {
		t.Fatal("must count Unicode characters")
	}
	if ValidName(" A ") {
		t.Fatal("single character name accepted")
	}
}
