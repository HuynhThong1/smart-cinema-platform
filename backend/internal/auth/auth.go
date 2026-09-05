package auth

import (
	"context"
	"errors"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
)

type Principal struct {
	Subject  string `json:"subject"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	CinemaID string `json:"cinemaId"`
}

func (p Principal) Global() bool             { return p.Role == "HEAD_OFFICE" || p.Role == "SYSTEM_ADMIN" }
func (p Principal) CanCinema(id string) bool { return p.Global() || (id != "" && id == p.CinemaID) }

type Verifier interface {
	Verify(context.Context, string) (Principal, error)
}
type Keycloak struct{ Verifier *oidc.IDTokenVerifier }

func New(ctx context.Context, issuer, audience string) (*Keycloak, error) {
	p, e := oidc.NewProvider(ctx, issuer)
	if e != nil {
		return nil, e
	}
	return &Keycloak{p.Verifier(&oidc.Config{ClientID: audience})}, nil
}
func (k *Keycloak) Verify(ctx context.Context, raw string) (Principal, error) {
	token, e := k.Verifier.Verify(ctx, raw)
	if e != nil {
		return Principal{}, e
	}
	var claims struct {
		Subject     string `json:"sub"`
		Username    string `json:"preferred_username"`
		CinemaID    string `json:"cinema_id"`
		RealmAccess struct {
			Roles []string `json:"roles"`
		} `json:"realm_access"`
	}
	if e = token.Claims(&claims); e != nil {
		return Principal{}, e
	}
	p := Principal{Subject: claims.Subject, Name: claims.Username, CinemaID: claims.CinemaID}
	for _, want := range []string{"SYSTEM_ADMIN", "HEAD_OFFICE", "CINEMA_MANAGER"} {
		for _, role := range claims.RealmAccess.Roles {
			if role == want && p.Role == "" {
				p.Role = role
			}
		}
	}
	if p.Role == "" || (p.Role == "CINEMA_MANAGER" && p.CinemaID == "") {
		return p, errors.New("missing authorization scope")
	}
	return p, nil
}
func Middleware(v Verifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !ok || raw == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required", "requestId": c.GetString("requestId")})
			return
		}
		p, e := v.Verify(c.Request.Context(), raw)
		if e != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired session", "requestId": c.GetString("requestId")})
			return
		}
		c.Set("principal", p)
		c.Next()
	}
}
func Current(c *gin.Context) Principal { return c.MustGet("principal").(Principal) }
