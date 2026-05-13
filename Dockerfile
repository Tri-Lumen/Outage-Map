FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
# Plain RUN (no BuildKit cache mounts) so the Dockerfile builds on Portainer
# hosts where BuildKit isn't enabled — the legacy builder rejects `--mount`
# with "unknown flag". Layer caching alone still skips this step on rebuilds
# when package-lock.json is unchanged.
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/app/data/outage.db

RUN apk add --no-cache su-exec \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /app/data \
    && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3100
VOLUME ["/app/data"]

# Tight interval + short start-period so docker marks the container healthy
# within ~5–10s of the Next.js server binding the port. Portainer's redeploy
# call gates on healthy state (via `docker compose up --wait` semantics); if
# the first check doesn't fire until 30s in and start-period is 60s, a stack
# update can run past the default HTTP/proxy timeout (~60s) and the "Saving…"
# spinner hangs even though the deploy itself succeeded. /api/status is a
# cheap SELECT against a small SQLite db, so a 5s interval is fine.
HEALTHCHECK --interval=5s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3100/api/status >/dev/null 2>&1 || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
