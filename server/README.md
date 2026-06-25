# Claude Sync Server

Self-hosted, multi-user store for Claude Code session bundles. Implements the API the
"Claude Sync Sessions" VSCode extension's server backend expects, plus user/token admin
and a sharing API.

## Run (Docker)

    docker compose up -d

Set an initial admin via env (`ADMIN_TOKEN`) on first start, or use the admin CLI:

    docker compose exec sync-server /admin create-user alice
    docker compose exec sync-server /admin create-user root --admin

### Storage & permissions

The image runs as the non-root user `uid 65532`, and `/data` in the image is owned by it,
so **Docker-managed volumes (named or anonymous) work out of the box** — use one:

    volumes:
      - sync-data:/data        # recommended

A **host bind-mount** (`- ./sync-data:/data`) keeps the *host* directory's ownership, so the
container can't write it unless the host dir is writable by uid 65532. With a bind-mount you
get `unable to open database file (14)` on start. Fix it with one of:

- use a Docker named volume instead (above), **or**
- make the host dir writable: `mkdir -p sync-data && sudo chown -R 65532:65532 sync-data`, **or**
- run the container as a uid that owns the dir, e.g. add `user: "0:0"` to the compose service.

## Configuration (env)

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8000` | Listen port. |
| `DATA_DIR` | `/data` | Blobs + SQLite live here. |
| `DB_PATH` | `$DATA_DIR/meta.db` | SQLite file. |
| `MAX_UPLOAD_BYTES` | `52428800` | Per-bundle upload cap (50 MiB). |
| `ADMIN_TOKEN` | — | If set and no users exist, creates `admin` with this token. |

## API

- `GET /health`
- `POST /api/sessions/push?project=&filename=` (gzip body) · `GET /api/sessions` · `GET /api/sessions/{prefix}` · `DELETE /api/sessions/{prefix}`
- `POST/GET/DELETE /api/admin/users`, `GET /api/admin/stats` (admin)
- `POST /api/sharing/share`, `GET /api/sharing/inbox`, `GET /api/sharing/outbox`, `DELETE /api/sharing/{id}`, `GET /api/sharing/{id}/bundle`

All endpoints except `/health` require `Authorization: Bearer <token>`.

## Develop

    cd server
    go test ./...
    go run ./cmd/server   # uses DATA_DIR (default /data — set DATA_DIR=./data locally)
