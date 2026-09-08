package domain

import (
	"regexp"
	"strings"
)

var transactionPattern = regexp.MustCompile(`^[0-9]{6,10}/[0-9]{3,5}$`)

// NormalizeTransaction discards malformed optional input without blocking feedback.
// Source is client-reported provenance, never proof that a ticket was verified.
func NormalizeTransaction(id, source string) (string, string) {
	id = strings.TrimSpace(id)
	if !transactionPattern.MatchString(id) {
		return "", "NONE"
	}
	switch source {
	case "QR_TICKET", "QR_SCAN", "MANUAL":
	default:
		source = "MANUAL"
	}
	return id, source
}
