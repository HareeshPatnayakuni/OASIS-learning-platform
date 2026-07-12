# OASIS Frontend — Optional self-hosted Dockerfile
#
# The default V1 deployment target for the frontend is Vercel (see
# docs/06-deployment-and-docker.md). This Dockerfile exists as a fallback
# path in case the frontend ever needs to be self-hosted (e.g., an internal/
# intranet deployment for the institute) — it is NOT part of the standard
# deployment flow and is not built/pushed by default CI.
#
# Unlike backend.Dockerfile, this one's build context IS just frontend/ (it
# has no cross-directory dependency on database/schema.prisma or anything
# else in the monorepo), so build it from the frontend/ directory itself:
#   docker build -f ../docker/frontend.Dockerfile -t oasis-frontend .
#
# Requires `output: "standalone"` in next.config.ts (already set) — that's
# what produces the .next/standalone directory this Dockerfile copies from.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
