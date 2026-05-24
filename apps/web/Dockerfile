# Multi-stage production build for the MapLab Next.js web app.
# Uses Next.js standalone output to produce a minimal runtime image.
#
# Build from repo root:
#   docker build -f apps/web/Dockerfile -t maplab-web .
#
# Run:
#   docker run -p 3000:3000 --env-file apps/web/.env.local maplab-web

# ── Stage 1: install dependencies ─────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN npm install -g pnpm@11.1.3

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN npm install -g pnpm@11.1.3

WORKDIR /app

COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/packages              ./packages
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm --filter @maplab/web build

# ── Stage 3: minimal runtime image ────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Copy standalone server (includes all runtime node_modules)
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/standalone ./

# Static assets and public files must be copied alongside the standalone server
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/public        ./apps/web/public

USER nextjs

EXPOSE 3000

# server.js is emitted by Next.js standalone into the root of the standalone dir
CMD ["node", "apps/web/server.js"]
