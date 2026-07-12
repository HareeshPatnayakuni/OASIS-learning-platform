# Module 2 — Implementation Notes
## Repository Scaffolding, Infrastructure & Auth Module

This document follows the project brief's per-module checklist (design
decisions, assumptions, trade-offs) without editing the frozen Module 1
docs (`docs/01`–`06`), per your instruction that Module 1 is the source of
truth and future modules build on it rather than revising it.

---

## 1. Schema addendum (additive only — nothing in Module 1 changed)

Two things Module 2 needed weren't in the frozen schema. Both are additive,
clearly delimited in `database/schema.prisma` under a
`MODULE 2 ADDENDUM` header, and don't touch any Module 1 model or field:

1. **`VerificationToken` model + `User.emailVerifiedAt`.** Email
   verification wasn't in Module 1's SRS — you added it when specifying
   Module 2. One table handles both email-verification and password-reset
   tokens (a `type` enum distinguishes them), since they share the exact
   same lifecycle: issued, single-use, expires, can be superseded by a
   newer request. Only a SHA-256 hash of each raw token is ever stored —
   same principle already used for `RefreshToken.token` in the frozen
   schema.
2. **`User.classGradeId` / `User.boardId` (both nullable).** The frozen
   FR-AUTH-1 already said registration collects a student's "target
   class/board," but the v1.1 schema had nowhere to put it. These are
   informational/personalization fields only — nothing in the Auth module
   uses them to gate access to anything.

## 2. Key design decisions

- **bcrypt over argon2id** (NFR-SEC-2 allows either), cost factor 12. Both
  are acceptable per the frozen NFR; bcrypt was chosen for broader
  operational familiarity and zero additional native-module risk across
  deployment targets. Isolated behind `password.util.ts` — swapping later
  is a one-file change, not a refactor.
- **Refresh tokens are opaque random strings, not JWTs.** They're stored
  (hashed) and looked up on every refresh anyway to support revocation and
  the 2-device limit, so a signed-but-still-DB-checked JWT would add parsing
  complexity without removing the DB dependency it's normally chosen to
  avoid. Rotated on every use (single-use, per `auth.service.ts`).
- **`authenticate` middleware is stateless** — it trusts the JWT signature
  and doesn't re-check `isActive` against the database on every request.
  Trade-off stated plainly in the code: a deactivated user's still-valid
  access token keeps working until it expires (≤15 min by default). Refresh
  rotation *does* check the database, so deactivation is caught at the next
  refresh at the latest. Closing this gap fully would mean a DB round-trip
  on every authenticated request — not worth it for a bounded, minutes-long
  staleness window.
- **Login vs. deactivation error messages are intentionally distinguishable**
  (`INVALID_CREDENTIALS` vs `ACCOUNT_DEACTIVATED`), unlike forgot-password/
  resend-verification, which always return the same generic response
  regardless of whether the email exists. This is a deliberate, narrow
  trade-off: telling a legitimately deactivated user *why* they can't log
  in is more useful than hiding it, and it leaks less than a full email
  enumeration oracle would (an attacker already needs a guessed email *and*
  the knowledge that guessing worked to exploit it, and the auth-specific
  rate limiter bounds how many guesses are cheap).
- **Registration does not auto-login.** No tokens are issued at
  `POST /auth/register` — the user registers, then explicitly logs in. This
  keeps "create an account" and "start a session" as two distinct, auditable
  actions, and sidesteps having to decide whether an unverified email should
  be allowed to start a session at all (see next point).
- **Email verification is a soft gate in V1** — an unverified user can still
  log in and use the platform; nothing currently checks
  `emailVerifiedAt`. Given delivery goes through a console-log transport
  until real SMTP credentials exist (see next point), hard-gating login on
  verification right now could lock out every single user. Flipping this to
  a hard gate later is a one-line check in `AuthService.login`.
- **Email transport defaults to logging, not sending.** `src/lib/email.ts`
  implements a `ConsoleEmailTransport` and is structured so a real
  SMTP/Resend/SES transport slots in behind the same `sendEmail()` call the
  moment credentials exist (env vars are already validated and ready in
  `config/env.ts`). Building an SMTP integration against credentials that
  don't exist yet would be exactly the premature infrastructure the Module 1
  brief warns against.
- **Auth-specific rate limiting** (`AUTH_RATE_LIMIT_*` env vars) is tighter
  than the general API limit and keyed by IP+email, mirroring the same
  reasoning Module 1 already applied to Enquiry submission.
- **RBAC middleware (`requireRole`) is fully implemented and unit-tested in
  this module, but no Auth route uses it** — every Auth endpoint is either
  public or "any authenticated user." That's expected: the first
  role-gated route (e.g. `POST /courses` restricted to `TEACHER`) arrives in
  Module 3 per the roadmap. Building and testing it now means it's ready
  the moment it's needed, not a rushed addition later.

## 3. Scope deliberately deferred (not part of Module 2's ask)

- **Teacher/Admin account provisioning** (`POST /users/teachers`,
  `POST /users/admins` in `docs/04-api-design.md`) belongs to the Users
  module, not Auth — only student self-registration is built here.
- **`GET/PATCH /users/me`, device management endpoints** — same reason;
  Auth issues and revokes sessions, but profile management is a different
  module's responsibility per the frozen API design.
- **A full UA-parsing dependency** for `deviceLabel` — a small heuristic
  (`parseDeviceLabel.ts`) covers the common browsers/OSes without adding a
  dependency for what's purely a display convenience.

## 4. One necessary correction to the frozen folder structure

`docs/02-architecture.md §3` lists the frontend's dashboard routes as
`(student)/dashboard/`, `(teacher)/dashboard/`, `(admin)/dashboard/` —
parenthesized, matching Next.js "route group" syntax. Building it literally
breaks: Next.js route groups are purely organizational and don't add a URL
segment, so all three `dashboard/page.tsx` files resolved to the exact same
path (`/dashboard`) and the build failed outright with a routing collision.

This wasn't a decision to revisit — it's a naming detail Module 1 didn't
have the chance to verify against an actual Next.js build. The fix:
`student/`, `teacher/`, `admin/` are real path segments (`/student/dashboard`,
`/teacher/dashboard`, `/admin/dashboard`), not route groups. `(public)/` and
`(auth)/` are unaffected and remain true route groups — their children
already have distinct paths (`/`, `/login`, `/register`,
`/forgot-password`), so there's no collision and no reason to change them.
Verified with a real `next build` (see `docs/02-architecture.md`'s
folder-structure intent — role separation — is fully preserved; only the
URL mechanics changed).

## 5. Docker configuration: two bugs caught, one verification gap

Reviewing Module 1's `docker/` files against the real backend/frontend code
(rather than trusting they'd still be correct once actual code existed)
turned up two real bugs, both fixed:

1. **`backend.Dockerfile` used `COPY ../database/schema.prisma ...`.**
   Docker's `COPY` can never reach outside its build context — this would
   have failed immediately on `docker build`. Fixed by moving the backend
   image's build context to the repository root (`docker-compose.yml`'s
   `context: ..`) so it can legitimately reach the sibling
   `database/schema.prisma`; `.dockerignore` was added at the repo root so
   that context change doesn't drag `frontend/node_modules` (hundreds of MB)
   into every backend build.
2. **`frontend.Dockerfile` copied `.next/standalone`,** but
   `next.config.ts` didn't set `output: "standalone"` — that directory would
   never have existed. Fixed by adding the config option; verified locally
   with a real `next build` that `.next/standalone/server.js` is produced.

**What wasn't verified:** this sandbox has no Docker daemon (`docker` is
not installed), so an actual `docker build` / `docker compose up` could not
be run end-to-end. Both Dockerfiles were reviewed line-by-line against the
real `package.json` scripts, file paths, and port numbers they reference,
and the underlying commands they call (`npm run build`,
`npx prisma generate`, `npx prisma migrate deploy`) were independently
verified to work in Module 2's testing (§7 below). Running
`docker compose up --build` for real is worth doing as an early step in
Module 3, before relying on it further.

## 6. On this sandbox's Prisma limitation

`prisma generate` / `prisma migrate` require downloading an engine binary
from `binaries.prisma.sh`, which is outside this sandbox's network
allowlist — confirmed as a hard block, not a transient failure, before
writing any code. This does **not** affect the delivered code, which is
100% standard Prisma usage that will work immediately with
`npm install && npx prisma migrate dev --name init` in any normal
environment. What it affected was *validating* the code here, which was
handled in layers:

1. **Structural schema validation** (brace balance, every named relation
   paired on both sides) — see Module 1 delivery for the original pass;
   re-run after the Module 2 addendum with the same result.
2. **Business logic tests run for real.** `AuthService` depends on an
   `AuthRepository` *interface* (Clean Architecture boundary, per
   `docs/02-architecture.md §2`), not on Prisma directly. All 64 unit tests
   run against a hand-written in-memory fake implementing that interface —
   no database or generated client involved, and this is standard practice
   for unit-testing a service layer regardless of the sandbox situation.
3. **A local-only stub client**, installed directly into
   `node_modules/.prisma/client` (never part of the delivered source tree —
   `node_modules` isn't shipped), let the full codebase — including
   `auth.repository.ts`, `app.ts`, `server.ts` — actually compile, lint, and
   *run* in this sandbox. With it: `npm run build` succeeds, and the
   compiled server was booted against the real local Postgres instance and
   exercised live — `/health` returned a genuine DB-connected 200,
   `/api/v1/docs.json` served a real generated OpenAPI spec, malformed
   registration requests correctly returned 400 with field-level details,
   an unknown route returned 404, and rate-limit headers were present and
   decrementing correctly. The only call that fails is the final
   `prisma.user.findFirst(...)` inside `auth.repository.ts`, which the stub
   deliberately rejects with an explanatory error — exactly the one piece
   that only the real generated client can provide.
4. **What this means for you:** the very first commands to run in a real
   environment are `npm install` (backend/) followed by
   `npx prisma migrate dev --name init` (or `npm run prisma:migrate:dev`).
   Nothing in the application code needs to change for that to work.

One honest residual: `npx eslint` shows `no-unsafe-*` warnings scoped
entirely to `auth.repository.ts` — the one file that talks to Prisma
directly — because the local stub types its delegates as `any` rather than
modeling Prisma's full generated type system. These are artifacts of the
stub, not the code; they will disappear the moment `prisma generate` runs
for real, and no suppression was added to mask them in the meantime.

## 7. Testing summary

77 unit tests across 7 suites, all passing:

| Suite | Covers |
|---|---|
| `auth.service.test.ts` | Registration, login (incl. device-limit enforcement at exactly 2/3 devices), refresh rotation, logout/logout-all, forgot/reset password (incl. token invalidation-on-reuse), email verification, resend |
| `auth.validators.test.ts` | Password policy, email normalization, UUID validation for optional fields |
| `password.util.test.ts` | Hashing, salting, verification, cost factor |
| `token.util.test.ts` | Token randomness/length, HMAC keying (§9 below) |
| `requireRole.test.ts` | RBAC middleware — allowed/denied roles, missing auth |
| `authenticate.test.ts` | JWT middleware — valid/missing/malformed/expired/forged tokens |
| `env.test.ts` | Fail-fast on missing/invalid config, production CORS safety, boolean env parsing |

Deliberately out of scope for Module 2 (per `docs/05-roadmap-and-milestones.md`,
this is Module 11's job): integration tests against a real database, load
testing, and CI wiring.

## 9. Pre-freeze verification pass

Before freezing Module 2, you asked for 10 specific security/production
items to be verified against the actual code — not assumed. Here's what
that check found, in the same numbering:

| # | Item | Result |
|---|---|---|
| 1 | Refresh tokens hashed before storage | ✅ Already correct — `AuthService.issueTokenPair` (`auth.service.ts`) hashes via `token.util.ts:hashToken` before `AuthRepository.createRefreshToken` ever sees it; the raw value only ever exists in the response body. |
| 2 | Password minimum complexity | ✅ Already correct — `auth.validators.ts`'s `passwordSchema`: min 8 characters, at least one letter, at least one number. |
| 3 | Email verification: expiration + resend | ✅ Already correct — 24h TTL (`constants.ts:EMAIL_VERIFICATION_TOKEN_TTL_HOURS`), enforced in `findValidVerificationTokenByHash`; `POST /auth/resend-verification` issues a fresh token and invalidates the previous one. |
| 4 | Dedicated login rate limiting | ✅ Already correct — `authRateLimiter` (`middleware/rateLimiters.ts`) applied to `/login` and every other public Auth endpoint, separate from `generalRateLimiter`, keyed by IP+email. |
| 5 | Secure production CORS | ⚠️ **Fixed.** The mechanism was already correct (an explicit origin allowlist, not a wildcard), but nothing stopped a production deploy from being left at the localhost default or a wildcard. `config/env.ts` now refuses to start (`process.exit(1)`) in production if `CORS_ORIGIN` is the dev default or contains `*` — same "fail fast on bad config" pattern as item 8. Verified live: a production boot with the default `CORS_ORIGIN` now exits immediately with a clear error; a real origin boots normally. |
| 6 | Separate JWT access/refresh secrets | ⚠️ **Fixed.** `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` were already two distinct, separately-validated env vars — but `JWT_REFRESH_SECRET` was declared and never actually used anywhere, since refresh tokens are opaque random strings, not JWTs (a Module 2 design decision, §2 above). The separation existed on paper only. `token.util.ts:hashToken` now uses `JWT_REFRESH_SECRET` as an HMAC-SHA256 key (instead of plain, unkeyed SHA-256) when hashing refresh/verification tokens for storage, making it a real, load-bearing secret, genuinely separate from the one used to sign access tokens. |
| 7 | Request/body size limits | ✅ Already correct — `app.use(express.json({ limit: '1mb' }))` in `app.ts`. |
| 8 | Fail-fast env validation | ✅ Already correct — `config/env.ts`'s `loadEnv()` runs at module-import time (before the server binds to a port) and calls `process.exit(1)` with a clear per-field error list on any missing/invalid required variable. |
| 9 | Swagger disableable in production | ❌ **Fixed — this one was a real gap.** Swagger was unconditionally mounted with no toggle at all. Added `SWAGGER_ENABLED` (boolean env var, defaults to `true` everywhere — the Module 1 brief wants these docs available for the future Android/iOS team, so "off in prod" isn't forced as a default, but it's now fully operator-configurable per deployment). Verified live: `SWAGGER_ENABLED=false` makes `/api/v1/docs.json` 404 while `/health` keeps working normally. |
| 10 | `/health` endpoint | ✅ Already correct — `GET /health` in `app.ts`, checks real DB connectivity, returns 200/503 accordingly. Already live-tested in the original Module 2 delivery. |

**One incidental fix while verifying item 6:** `backend/.env.example` had
`JWT_REFRESH_EXPIRY=30d` — the wrong variable name (code reads
`JWT_REFRESH_EXPIRY_DAYS`, a number, not a duration string) — so setting it
in a real `.env` file would have silently done nothing. Also added several
variables that existed in code but were missing from the example file
(`AUTH_RATE_LIMIT_*`, `FRONTEND_URL`, `SMTP_*`, `EMAIL_FROM`,
`SWAGGER_ENABLED`). `.env.example` now matches `env.ts` exactly — verified
by diffing the two.

**Test coverage added for all three fixes:** `token.util.test.ts` now
verifies the hash is genuinely keyed (a different key produces a different
digest, not just "some digest"); `env.test.ts` (new) verifies the
fail-fast behavior for missing config, the new production CORS check in
both directions (rejects unsafe values, accepts a real origin, and doesn't
apply outside production), and correct `SWAGGER_ENABLED` boolean parsing
(explicitly guarding against the `Boolean("false") === true` JavaScript
footgun that `z.coerce.boolean()` would have walked into).

---

## Module 2: FROZEN

Per your instruction, Module 2 — repository scaffolding, Docker
configuration, Prisma setup, and the Auth module (registration, login, JWT,
RBAC, Swagger, logging, validation, error handling) — is now, alongside
Module 1, part of the project's permanent architecture. Future modules
build on top of what's here (the `AuthRepository` interface pattern, the
middleware pipeline, the error envelope, the rate-limiter split, the
env-validation approach) rather than redesigning it. Module 3 (Board/Class/
Subject catalog + Course/Chapter/Module/Lecture/Note/Quiz CRUD, per
`docs/05-roadmap-and-milestones.md`) is next.

## 10. Quick reference

```bash
# Backend
cd backend
npm install
cp .env.example .env               # fill in real secrets
npx prisma migrate dev --name init --schema=../database/schema.prisma
npm run seed
npm run dev                        # http://localhost:4000, docs at /api/v1/docs

npm test                           # 77 tests
npm run lint
npm run build && npm start         # production build

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev                        # http://localhost:3000
npm run lint
npm run build                      # verified clean in this sandbox — see §4
```
