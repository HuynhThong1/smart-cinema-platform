package domain

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

func ID() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

var phonePattern = regexp.MustCompile(`^(0[0-9]{9}|\+?84[0-9]{9})$`)
var phoneSeparators = strings.NewReplacer(" ", "", "-", "", "(", "", ")", "", ".", "")

func NormalizePhone(raw string) (string, error) {
	v := phoneSeparators.Replace(strings.TrimSpace(raw))
	if !phonePattern.MatchString(v) {
		return "", errors.New("Số điện thoại không đúng định dạng Việt Nam")
	}
	v = strings.TrimPrefix(v, "+")
	if strings.HasPrefix(v, "0") {
		v = "84" + v[1:]
	}
	return v, nil
}
func ValidName(v string) bool {
	n := utf8.RuneCountInString(strings.TrimSpace(v))
	return n >= 2 && n <= 100
}
func Contains(values []int, n int) bool {
	for _, v := range values {
		if v == n {
			return true
		}
	}
	return false
}
func ValidStatus(v string) bool { return v == "ACTIVE" || v == "INACTIVE" }
func ValidateConfig(v FeedbackConfig) error {
	if v.RatingType != "ICON+TEXT" && v.RatingType != "STAR" && v.RatingType != "BUTTON" && v.RatingType != "TEXT" {
		return errors.New("Invalid rating type")
	}
	if v.MinimumFeedbackForRanking < 1 || v.MinimumFeedbackForRanking > 10000 {
		return errors.New("Invalid ranking minimum")
	}
	if v.ConsentVersion == "" || len(v.ConsentVersion) > 50 {
		return errors.New("Consent version required")
	}
	if len(v.RatingOptions) != 5 {
		return errors.New("Scale must contain values 1–5")
	}
	seen := map[int]bool{}
	enabled := 0
	for _, r := range v.RatingOptions {
		if r.Value < 1 || r.Value > 5 || seen[r.Value] || !ValidName(r.Label) {
			return errors.New("Invalid or duplicate rating option")
		}
		seen[r.Value] = true
		if r.Enabled {
			enabled++
		}
	}
	if enabled == 0 {
		return errors.New("At least one rating must be enabled")
	}
	return nil
}
func ValidateReason(v Reason) error {
	if !regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,49}$`).MatchString(v.Code) || !ValidName(v.Label) {
		return errors.New("Reason code and label required")
	}
	if v.Status != "ACTIVE" && v.Status != "DISABLED" {
		return errors.New("Invalid status")
	}
	if v.Type != "POSITIVE" && v.Type != "NEGATIVE" && v.Type != "BOTH" && v.Type != "NEUTRAL" {
		return errors.New("Invalid category")
	}
	if len(v.Ratings) == 0 {
		return errors.New("Rating range required")
	}
	seen := map[int]bool{}
	for _, n := range v.Ratings {
		if n < 1 || n > 5 || seen[n] {
			return errors.New("Invalid rating range")
		}
		seen[n] = true
	}
	return nil
}
