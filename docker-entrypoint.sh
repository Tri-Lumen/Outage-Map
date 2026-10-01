#!/bin/sh
set -e

# /app/data is a named docker volume (`outage-map-data`). If the volume was
# ever populated by a container running as a different uid — or if Portainer
# pre-creates the mount point as root — the uid 1001 `nextjs` user can't
# write `outage.db`, getDb() throws, /api/status 500s, the HEALTHCHECK fails,
# and Portainer keeps the stack in "starting" forever. Fix the ownership on
# every boot, then drop privileges.
echo "[entrypoint] preparing /app/data"
mkdir -p /app/data
# The volume only ever needs the recursive chown once — every subsequent
# write happens as the nextjs user already (nothing else touches this
# volume), so once the top-level directory itself is owned correctly, a
# recursive re-chown on every restart is wasted work that scales with
# however much the SQLite file/WAL/backups have grown. Skip it when
# ownership is already right; fall back to running it if `stat` itself
# fails for any reason (never silently skip on a check we can't trust).
owner="$(stat -c '%u:%g' /app/data 2>/dev/null || true)"
if [ "$owner" != "1001:1001" ]; then
  echo "[entrypoint] fixing /app/data ownership (was: ${owner:-unknown})"
  chown -R nextjs:nodejs /app/data
fi

echo "[entrypoint] starting: $*"
exec su-exec nextjs:nodejs "$@"
