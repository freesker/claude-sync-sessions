# Base images pulled via Google's public Docker Hub mirror (mirror.gcr.io) instead of
# docker.io — avoids Docker Hub rate limits. (alpine isn't published on gcr.io directly.)
# No `# syntax=` directive so the build never pulls a frontend image from docker.io.
FROM mirror.gcr.io/library/golang:1.22 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64
RUN go build -ldflags="-s -w" -o /out/server ./cmd/server \
 && go build -ldflags="-s -w" -o /out/admin ./cmd/admin

FROM mirror.gcr.io/library/alpine:3.20
RUN apk add --no-cache su-exec
COPY --from=build /out/server /server
COPY --from=build /out/admin /admin
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENV DATA_DIR=/data
EXPOSE 8000
VOLUME ["/data"]
# Starts as root to make DATA_DIR writable (incl. host bind-mounts), then drops to
# the non-root runtime uid via su-exec (see docker-entrypoint.sh).
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["server"]
