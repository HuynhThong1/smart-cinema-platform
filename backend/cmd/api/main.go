package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"smartcinema/internal/auth"
	"smartcinema/internal/repository"
	"smartcinema/internal/server"
	"strings"
	"syscall"
	"time"
)

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func listenAddress() string {
	if address := os.Getenv("API_ADDR"); address != "" {
		return address
	}
	if port := os.Getenv("PORT"); port != "" {
		return "0.0.0.0:" + port
	}
	return "127.0.0.1:8080"
}

func oidcIssuer() string {
	if issuer := os.Getenv("OIDC_ISSUER"); issuer != "" {
		return strings.TrimRight(issuer, "/")
	}
	if keycloakURL := os.Getenv("KEYCLOAK_URL"); keycloakURL != "" {
		return strings.TrimRight(keycloakURL, "/") + "/realms/smart-cinema"
	}
	return "http://localhost:8081/realms/smart-cinema"
}

func corsOrigins() []string {
	if origins := os.Getenv("CORS_ORIGINS"); origins != "" {
		return strings.Split(origins, ",")
	}
	var origins []string
	for _, key := range []string{"ADMIN_URL", "PUBLIC_URL"} {
		if value := strings.TrimRight(os.Getenv(key), "/"); value != "" {
			origins = append(origins, value)
		}
	}
	if len(origins) > 0 {
		return origins
	}
	return []string{"http://localhost:4200", "http://localhost:4201"}
}

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	secret := os.Getenv("IP_HASH_SECRET")
	if len(secret) < 32 {
		slog.Error("IP_HASH_SECRET must contain at least 32 characters")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	store, e := repository.Connect(ctx, env("MONGODB_URI", "mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true"), env("MONGODB_DATABASE", "smart_cinema"))
	if e != nil {
		slog.Error("MongoDB initialization failed", "error", e)
		os.Exit(1)
	}
	defer store.DB.Client().Disconnect(context.Background())
	issuer := oidcIssuer()
	verifier, e := auth.New(ctx, issuer, env("OIDC_AUDIENCE", "smart-cinema-api"))
	if e != nil {
		slog.Error("OIDC initialization failed", "error", e)
		os.Exit(1)
	}
	s := &server.Server{Users: auth.NewUserAdmin(issuer, env("KEYCLOAK_SERVICE_CLIENT", "smart-cinema-service"), os.Getenv("KEYCLOAK_SERVICE_SECRET")), TrustedProxies: strings.Split(env("TRUSTED_PROXIES", "127.0.0.1,::1"), ","), Store: store, PublicURL: strings.TrimRight(env("PUBLIC_URL", "http://localhost:4201"), "/"), IPHashSecret: secret}
	if e = s.Seed(ctx, os.Getenv("SEED_DEVELOPMENT") == "true"); e != nil {
		slog.Error("Database seed failed", "error", e)
		os.Exit(1)
	}
	srv := &http.Server{Addr: listenAddress(), Handler: s.Router(verifier, corsOrigins()), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	go func() {
		slog.Info("API listening", "address", srv.Addr)
		if e := srv.ListenAndServe(); e != nil && e != http.ErrServerClosed {
			slog.Error("HTTP server failed", "error", e)
			os.Exit(1)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdown, done := context.WithTimeout(context.Background(), 10*time.Second)
	defer done()
	_ = srv.Shutdown(shutdown)
}
