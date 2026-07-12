# Deployment Strategy & Docker Setup
## OASIS V1 — Module 1 Deliverable (v1.1 — post-refinement)

> **Revision note:** the only substantive change in this revision is that
> object storage now requires **two** Cloudflare R2 buckets instead of one
> (private video/notes + public/CDN-fronted media — see
> `docs/02-architecture.md §8`), which adds a small set of environment
> variables (§6). Everything else in this document is unchanged from v1.0.

---

## 1. Deployment Topology

| Component | Where | Why |
|---|---|---|
| Frontend (Next.js) | **Vercel** | Best-in-class Next.js support: ISR, edge caching, image optimization, zero-config previews per PR |
| Backend (Express, Dockerized) | **Any Docker host** — Render, Railway, DigitalOcean (App Platform or a Droplet), AWS (ECS/EC2), or a bare VPS | Brief requires provider-agnostic deployment; Docker + env vars is what makes that true |
| Database | Managed PostgreSQL (Render/Railway/Neon/RDS — provider chosen at Module 10, not baked in now) | Managed backups/patching reduce ops burden for a small team |
| Object storage — private | Cloudflare R2 (bucket 1) | Lecture videos & notes; signed URLs only, never public |
| Object storage — public/media | Cloudflare R2 (bucket 2, CDN-fronted) **[NEW]** | Course thumbnails, avatars, logo, testimonial photos — see `docs/02-architecture.md §8`. Kept in a *separate* bucket with separate credentials so a misconfiguration on one can't expose the other (NFR-SEC-10) |
| Payments | Razorpay | Required by brief |

The backend has **zero code paths specific to any one host.** Everything that
differs between Render/Railway/DigitalOcean/AWS/VPS is an environment
variable or a platform-level config (health check path, port binding), never
an `if (process.env.PLATFORM === 'render')` branch in application code.

---

## 2. Local Development

`docker/docker-compose.yml` brings up Postgres + the backend together so a
new contributor can run the whole backend stack with one command, without
installing Postgres locally. The frontend is run separately via `npm run dev`
(Next.js dev server is fast enough that Dockerizing it for local dev adds
friction without much benefit) — but `docker/frontend.Dockerfile` exists for
the rare case of needing to self-host the frontend instead of using Vercel
(e.g., an intranet deployment for the institute), keeping that option open
without committing to it.

```bash
# from docker/
docker compose up --build
```

---

## 3. Environment Separation

Three environments are anticipated from the start, even though V1 launches
with just two in practice:

| Environment | Frontend | Backend | Database |
|---|---|---|---|
| Local dev | `next dev` | `docker compose up` (local Postgres) | Dockerized Postgres |
| Staging *(optional for V1, recommended before real payments go live)* | Vercel preview deployment | Separate container + separate DB, Razorpay **test mode** | Separate managed Postgres instance |
| Production | Vercel production deployment | Production container, Razorpay **live mode** | Production managed Postgres instance |

Using Razorpay test mode in a staging environment before ever touching live
mode is strongly recommended so the payment-verification flow is proven
before real money moves.

---

## 4. Release / Migration Process

1. CI runs lint + typecheck + tests (Module 9 onward) on every push.
2. On merge to `main`, the backend Docker image is built and pushed to the
   chosen registry (GitHub Container Registry works across all target hosts).
3. `prisma migrate deploy` runs as a release step (or an init container)
   *before* the new backend version starts serving traffic, so schema and
   code version always move together.
4. Vercel deploys the frontend independently on merge; since the API
   contract is versioned (`/api/v1`), frontend and backend don't have to
   deploy in lockstep.

---

## 5. Operational Concerns

- **Logging:** structured JSON logs to stdout (e.g., via `pino`), so whatever
  host is chosen can capture them with its native log aggregation — no
  vendor-specific logging SDK in the app. Full detail (request correlation
  IDs, redaction, log fields) is in `docs/02-architecture.md §11`.
- **Health check:** `GET /health` returns 200 + a DB connectivity check, used
  by whichever platform's load balancer/orchestrator needs it.
- **Backups:** daily automated Postgres backups (via the managed provider's
  built-in backup feature) plus R2's own object versioning as a second line
  of defense for uploaded content.
- **Secrets:** every credential (JWT secrets, DB URL, R2 keys, Razorpay keys)
  is an environment variable, set directly in the hosting platform's secret
  manager — never committed, never in a Dockerfile `ENV` instruction.
- **Monitoring (post-V1 hook, not built now):** the stateless, logged-to-stdout
  design means adding Sentry (errors) or a metrics agent later is additive —
  no architecture change required.

---

## 6. Environment Variables Reference

See `backend/.env.example` and `frontend/.env.example` for the literal files.
Summary:

### Backend
| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` \| `staging` \| `production` |
| `PORT` | Port the Express server binds to |
| `DATABASE_URL` | Postgres connection string (used by Prisma) |
| `JWT_ACCESS_SECRET` | Signs short-lived access tokens |
| `JWT_REFRESH_SECRET` | Signs longer-lived refresh tokens |
| `JWT_ACCESS_EXPIRY` | e.g. `15m` |
| `JWT_REFRESH_EXPIRY` | e.g. `30d` |
| `CORS_ORIGIN` | Allowed frontend origin(s) |
| `R2_ACCOUNT_ID` | Cloudflare R2 account |
| `R2_PRIVATE_ACCESS_KEY_ID` / `R2_PRIVATE_SECRET_ACCESS_KEY` | Credentials scoped to the **private** bucket (S3-compatible) |
| `R2_PRIVATE_BUCKET_NAME` | Bucket holding private lecture videos & notes |
| `R2_PUBLIC_ACCESS_KEY_ID` / `R2_PUBLIC_SECRET_ACCESS_KEY` **[NEW]** | Credentials scoped to the **public/media** bucket — deliberately separate from the private ones (NFR-SEC-10) |
| `R2_PUBLIC_BUCKET_NAME` **[NEW]** | Bucket holding course thumbnails, avatars, logo, testimonial photos |
| `R2_PUBLIC_CDN_BASE_URL` **[NEW]** | Public base URL used to construct each `Media.publicUrl` (custom domain or R2.dev subdomain) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay API credentials |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies incoming webhook signatures |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Rate limiter tuning |
| `LOG_LEVEL` | e.g. `info`, `debug` |

### Frontend
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base, e.g. `https://api.oasis.example.com/api/v1` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Public Razorpay key for the checkout widget (secret stays backend-only) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL, used for SEO metadata/sitemap generation |

Full literal `.env.example` files are already scaffolded in this repo at
`backend/.env.example` and `frontend/.env.example` — copy to `.env` and fill
in real values per environment; never commit the filled-in file.
