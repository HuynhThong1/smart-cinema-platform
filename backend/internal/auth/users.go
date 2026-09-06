package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"golang.org/x/oauth2/clientcredentials"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ErrNotFound reports that the identity service has no such record, so callers
// can tell a deleted account apart from an upstream outage.
var ErrNotFound = errors.New("identity record not found")

type User struct {
	ID                string              `json:"id,omitempty"`
	Username          string              `json:"username"`
	FirstName         string              `json:"firstName"`
	LastName          string              `json:"lastName"`
	Email             string              `json:"email"`
	Enabled           bool                `json:"enabled"`
	Role              string              `json:"role,omitempty"`
	CinemaID          string              `json:"cinemaId,omitempty"`
	TemporaryPassword string              `json:"temporaryPassword,omitempty"`
	Attributes        map[string][]string `json:"attributes,omitempty"`
}
type UserAdmin struct {
	Base   string
	Client *http.Client
}

func NewUserAdmin(issuer, id, secret string) *UserAdmin {
	if secret == "" {
		return nil
	}
	cfg := clientcredentials.Config{ClientID: id, ClientSecret: secret, TokenURL: issuer + "/protocol/openid-connect/token"}
	client := cfg.Client(context.Background())
	client.Timeout = 15 * time.Second
	parts := strings.Split(issuer, "/realms/")
	if len(parts) != 2 {
		return nil
	}
	return &UserAdmin{Base: parts[0] + "/admin/realms/" + url.PathEscape(parts[1]), Client: client}
}
func (a *UserAdmin) request(ctx context.Context, method, path string, body, out any) (http.Header, error) {
	var b bytes.Buffer
	if body != nil {
		if e := json.NewEncoder(&b).Encode(body); e != nil {
			return nil, e
		}
	}
	req, e := http.NewRequestWithContext(ctx, method, a.Base+path, &b)
	if e != nil {
		return nil, e
	}
	req.Header.Set("Content-Type", "application/json")
	res, e := a.Client.Do(req)
	if e != nil {
		return nil, e
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound {
		return nil, ErrNotFound
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("identity service returned %d", res.StatusCode)
	}
	if out != nil {
		e = json.NewDecoder(io.LimitReader(res.Body, 2<<20)).Decode(out)
	}
	return res.Header, e
}

type realmRole struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func validRole(r string) bool {
	return r == "SYSTEM_ADMIN" || r == "HEAD_OFFICE" || r == "CINEMA_MANAGER"
}
func (a *UserAdmin) List(ctx context.Context, search string, first, max int) ([]User, int, error) {
	users := []User{}
	q := url.Values{"briefRepresentation": {"false"}, "first": {fmt.Sprint(first)}, "max": {fmt.Sprint(max)}}
	if search != "" {
		q.Set("search", search)
	}
	_, e := a.request(ctx, "GET", "/users?"+q.Encode(), nil, &users)
	if e != nil {
		return nil, 0, e
	}
	for i := range users {
		var roles []realmRole
		_, e = a.request(ctx, "GET", "/users/"+url.PathEscape(users[i].ID)+"/role-mappings/realm", nil, &roles)
		if e != nil {
			return nil, 0, e
		}
		for _, r := range roles {
			if validRole(r.Name) {
				users[i].Role = r.Name
			}
		}
		if v := users[i].Attributes["cinema_id"]; len(v) > 0 {
			users[i].CinemaID = v[0]
		}
		users[i].Attributes = nil
	}
	var count int
	countQuery := url.Values{}
	if search != "" {
		countQuery.Set("search", search)
	}
	_, e = a.request(ctx, "GET", "/users/count?"+countQuery.Encode(), nil, &count)
	return users, count, e
}
func (a *UserAdmin) Save(ctx context.Context, u User) (User, error) {
	if !validRole(u.Role) {
		return u, errors.New("invalid role")
	}
	var desired realmRole
	if _, e := a.request(ctx, "GET", "/roles/"+url.PathEscape(u.Role), nil, &desired); e != nil {
		return u, e
	}
	payload := map[string]any{"username": u.Username, "firstName": u.FirstName, "lastName": u.LastName, "email": u.Email, "enabled": u.Enabled, "attributes": map[string][]string{"cinema_id": {u.CinemaID}}}
	if u.ID == "" {
		payload["credentials"] = []map[string]any{{"type": "password", "value": u.TemporaryPassword, "temporary": true}}
		header, e := a.request(ctx, "POST", "/users", payload, nil)
		if e != nil {
			return u, e
		}
		location := header.Get("Location")
		u.ID = location[strings.LastIndex(location, "/")+1:]
		if u.ID == "" {
			return u, errors.New("identity service did not return user id")
		}
	} else {
		if _, e := a.request(ctx, "PUT", "/users/"+url.PathEscape(u.ID), payload, nil); e != nil {
			return u, e
		}
	}
	// Grant the desired role, then remove only the platform roles that it replaces.
	rolePath := "/users/" + url.PathEscape(u.ID) + "/role-mappings/realm"
	if _, e := a.request(ctx, "POST", rolePath, []realmRole{desired}, nil); e != nil {
		return u, e
	}
	var roles []realmRole
	if _, e := a.request(ctx, "GET", rolePath, nil, &roles); e != nil {
		return u, e
	}
	remove := []realmRole{}
	for _, r := range roles {
		if validRole(r.Name) && r.Name != u.Role {
			remove = append(remove, r)
		}
	}
	if len(remove) > 0 {
		if _, e := a.request(ctx, "DELETE", rolePath, remove, nil); e != nil {
			return u, e
		}
	}
	if _, e := a.request(ctx, "POST", "/users/"+url.PathEscape(u.ID)+"/logout", nil, nil); e != nil {
		return u, e
	}
	u.TemporaryPassword = ""
	return u, nil
}

func (a *UserAdmin) Delete(ctx context.Context, id string) error {
	_, e := a.request(ctx, "DELETE", "/users/"+url.PathEscape(id), nil, nil)
	return e
}

// Get resolves current role and scope, including inherited realm roles.
func (a *UserAdmin) Get(ctx context.Context, id string) (User, error) {
	var u User
	path := "/users/" + url.PathEscape(id)
	if _, err := a.request(ctx, "GET", path, nil, &u); err != nil {
		return u, err
	}
	var roles []realmRole
	if _, err := a.request(ctx, "GET", path+"/role-mappings/realm/composite", nil, &roles); err != nil {
		return u, err
	}
	for _, role := range roles {
		if role.Name == "CINEMA_MANAGER" {
			u.Role = role.Name
		}
	}
	if ids := u.Attributes["cinema_id"]; len(ids) > 0 {
		u.CinemaID = ids[0]
	}
	u.Attributes = nil
	return u, nil
}

// Managers pages through role members so the selector does not silently omit users.
func (a *UserAdmin) Managers(ctx context.Context, cinemaID string) ([]User, error) {
	out := []User{}
	// Bounded so an identity service that keeps returning full pages for an
	// out-of-range offset cannot hold the request handler open forever.
	for first := 0; first < 100*50; first += 100 {
		var batch []User
		path := fmt.Sprintf("/roles/CINEMA_MANAGER/users?briefRepresentation=false&first=%d&max=100", first)
		if _, err := a.request(ctx, "GET", path, nil, &batch); err != nil {
			return nil, err
		}
		for _, u := range batch {
			if ids := u.Attributes["cinema_id"]; u.Enabled && len(ids) > 0 && ids[0] == cinemaID {
				out = append(out, User{ID: u.ID, Username: u.Username, FirstName: u.FirstName, LastName: u.LastName})
			}
		}
		if len(batch) < 100 {
			return out, nil
		}
	}
	return nil, errors.New("identity service returned too many manager pages")
}
