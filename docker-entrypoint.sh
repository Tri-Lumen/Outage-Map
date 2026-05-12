#!/bin/sh
set -e

# /app/data is a named docker volume (`outage-map-data`). If the volume was
# ever populated by a container running as a different uid — or if Portainer
# pre-creates the mount point as root — the uid 1001 `nextjs` user can't
# write `outage.db`, getDb() throws, /api/status 500s, the HEALTHCHECK fails,
# and Portainer keeps the stack in "starting" forever. Fix the ownership on
# every boot, then drop privileges.
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

exec su-exec nextjs:nodejs "$@"
