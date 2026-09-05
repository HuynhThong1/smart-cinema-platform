package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestOIDCRejectsInvalidAudienceIssuerExpiryAndScope(t *testing.T) {
	key, e := rsa.GenerateKey(rand.Reader, 2048)
	if e != nil {
		t.Fatal(e)
	}
	var issuer string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/.well-known/openid-configuration" {
			_ = json.NewEncoder(w).Encode(map[string]any{"issuer": issuer, "jwks_uri": issuer + "/keys", "id_token_signing_alg_values_supported": []string{"RS256"}})
		} else {
			_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "test", Algorithm: "RS256", Use: "sig"}}})
		}
	}))
	defer srv.Close()
	issuer = srv.URL
	verifier, e := New(context.Background(), issuer, "smart-cinema-api")
	if e != nil {
		t.Fatal(e)
	}
	signer, e := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: jose.JSONWebKey{Key: key, KeyID: "test"}}, nil)
	if e != nil {
		t.Fatal(e)
	}
	for _, tc := range []struct {
		name, audience, tokenIssuer, cinema string
		expiry                              time.Time
		valid                               bool
	}{
		{"valid", "smart-cinema-api", issuer, "cinema-gnd", time.Now().Add(time.Hour), true},
		{"wrong audience", "other-api", issuer, "cinema-gnd", time.Now().Add(time.Hour), false},
		{"wrong issuer", "smart-cinema-api", "https://other.example", "cinema-gnd", time.Now().Add(time.Hour), false},
		{"expired", "smart-cinema-api", issuer, "cinema-gnd", time.Now().Add(-time.Hour), false},
		{"missing scope", "smart-cinema-api", issuer, "", time.Now().Add(time.Hour), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			raw, e := jwt.Signed(signer).Claims(jwt.Claims{Issuer: tc.tokenIssuer, Subject: "manager", Audience: jwt.Audience{tc.audience}, Expiry: jwt.NewNumericDate(tc.expiry)}).Claims(map[string]any{"preferred_username": "manager", "cinema_id": tc.cinema, "realm_access": map[string]any{"roles": []string{"CINEMA_MANAGER"}}}).Serialize()
			if e != nil {
				t.Fatal(e)
			}
			p, e := verifier.Verify(context.Background(), raw)
			if (e == nil) != tc.valid {
				t.Fatalf("unexpected verification result: %v", e)
			}
			if tc.valid && p.CinemaID != "cinema-gnd" {
				t.Fatal("scope lost")
			}
		})
	}
}
