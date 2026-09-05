FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags='-s -w' -o /api ./cmd/api
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /api /api
ENV API_ADDR=0.0.0.0:8080
EXPOSE 8080
ENTRYPOINT ["/api"]
