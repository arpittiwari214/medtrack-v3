# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# MedTrack API.
#
# Multi-stage so the runtime image carries no TypeScript, no dev
# dependencies and no source — only compiled JS and prod deps.
#
# Built from the REPOSITORY ROOT, not from apps/api, because the API
# depends on the `@medtrack/shared` workspace package:
#
#   docker build -f apps/api/Dockerfile -t medtrack-api .
# ─────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
WORKDIR /app
# dumb-init reaps zombies and forwards SIGTERM properly, so the graceful
# shutdown in server.ts actually runs on deploy.
RUN apk add --no-cache dumb-init

# ── Dependencies ─────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
# Only the workspaces the API needs; the web and mobile apps are irrelevant here.
RUN npm ci --workspace @medtrack/shared --workspace @medtrack/api --include-workspace-root

# ── Build ────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm run build --workspace @medtrack/shared \
 && npm run build --workspace @medtrack/api

# ── Runtime ──────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci --omit=dev --workspace @medtrack/shared --workspace @medtrack/api --include-workspace-root \
 && npm cache clean --force

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Run unprivileged. The node image ships a `node` user for exactly this.
USER node

EXPOSE 5000

# The platform's own health check should hit /api/health, which reports
# database connectivity rather than merely "the process is alive".
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/server.js"]
