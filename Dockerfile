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

# /api/health is a static 200 OK that doesn't touch the database — so the
# first probe succeeds the moment the Next.js server binds the port, even on
# a fresh volume where SQLite still needs to run its CREATE TABLE migrations.
# Combined with the short start-period this lets the container reach
# `healthy` within a couple of seconds, well inside the upstream HTTP/proxy
# timeout that Portainer's stack-update call rides on.
HEALTHCHECK --interval=3s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3100/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
