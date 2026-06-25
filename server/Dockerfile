# syntax=docker/dockerfile:1
FROM golang:1.22 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64
RUN go build -ldflags="-s -w" -o /out/server ./cmd/server \
 && go build -ldflags="-s -w" -o /out/admin ./cmd/admin \
 && mkdir -p /data

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/server /server
COPY --from=build /out/admin /admin
# Own /data as the nonroot user (uid 65532) so Docker-managed (named/anonymous)
# volumes are writable. NOTE: a host bind-mount keeps the HOST dir's ownership, so
# for `-v ./dir:/data` the host dir must be writable by uid 65532 (or run the
# container as a uid that owns it). See README.
COPY --from=build --chown=65532:65532 /data /data
ENV DATA_DIR=/data
EXPOSE 8000
VOLUME ["/data"]
ENTRYPOINT ["/server"]
