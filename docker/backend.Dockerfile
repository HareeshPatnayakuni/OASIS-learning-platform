# OASIS Backend — Production Dockerfile
# Multi-stage build: compile TypeScript in a full node image, run the
# compiled output in a slim image. This is the SAME image used regardless of
# host (Render/Railway/DigitalOcean/AWS/VPS) — only environment variables
# change between deployments.
#
# IMPORTANT: the build context for this Dockerfile is the REPOSITORY ROOT
# (see ../docker/docker-compose.yml — `context: ..`), not backend/. Docker's
# COPY instruction cannot reach outside its build context, and this image
# needs both backend/ and the sibling database/schema.prisma, so the
# context has to be the directory that contains both. If you're running
# `docker build` by hand rather than via docker-compose, run it from the
# repository root:
#   docker build -f docker/backend.Dockerfile -t oasis-backend .

# ---------- Stage 1: deps + build ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/ .
COPY database/schema.prisma ./prisma/schema.prisma

RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

# ---------- Stage 2: production runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY backend/package*.json ./
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
