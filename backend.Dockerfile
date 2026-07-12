# OASIS Backend — Production Dockerfile
# Multi-stage build: compile TypeScript in a full node image, run the
# compiled output in a slim image. This is the SAME image used regardless of
# host (Render/Railway/DigitalOcean/AWS/VPS) — only environment variables
# change between deployments.
#
# NOTE: This Dockerfile assumes the standard backend/ layout defined in
# docs/02-architecture.md (package.json, tsconfig.json, src/, prisma schema
# referenced via ../database/schema.prisma). It will be exercised for real
# starting in Module 2 once the backend source exists.

# ---------- Stage 1: deps + build ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
COPY ../database/schema.prisma ./prisma/schema.prisma

RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

# ---------- Stage 2: production runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000

# Any host (Render/Railway/DO/AWS/VPS) can hit this for health checks.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Run pending migrations, then start the server. Safe to run on every boot —
# `migrate deploy` is a no-op if there's nothing pending.
CMD npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/server.js
