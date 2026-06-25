#!/bin/sh
set -e

# Runtime uid:gid the server actually runs as (non-root).
RUN_UID=65532
RUN_GID=65532
DATA="${DATA_DIR:-/data}"

# Make the data dir writable by the runtime user. On a host bind-mount this also
# fixes the host directory's ownership, so no manual chown is ever needed.
mkdir -p "$DATA"
chown -R "$RUN_UID:$RUN_GID" "$DATA" 2>/dev/null || true

# First argument selects the binary; default is the server. Drop privileges.
cmd="${1:-server}"
case "$cmd" in
  server) exec su-exec "$RUN_UID:$RUN_GID" /server ;;
  admin)  shift;        exec su-exec "$RUN_UID:$RUN_GID" /admin "$@" ;;
  *)      exec "$@" ;;
esac
