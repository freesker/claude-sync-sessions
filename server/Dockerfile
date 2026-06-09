# syntax=docker/dockerfile:1
FROM golang:1.22 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64
RUN go build -ldflags="-s -w" -o /out/server ./cmd/server \
 && go build -ldflags="-s -w" -o /out/admin ./cmd/admin

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/server /server
COPY --from=build /out/admin /admin
ENV DATA_DIR=/data
EXPOSE 8000
VOLUME ["/data"]
ENTRYPOINT ["/server"]
