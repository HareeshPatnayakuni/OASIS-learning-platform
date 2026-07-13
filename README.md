# OASIS — Online Academy for Smart Integrated Studies

> **Learn From Home. Excel Everywhere.**

OASIS is a coaching-institute learning platform for students in Classes 4–10
across CBSE, ICSE, and State Board curricula. It lets teachers publish
structured video courses with notes and quizzes, lets students buy and
consume that content, and gives admins a dashboard to run the business side
(students, teachers, payments, testimonials, enquiries, site settings).

This repository is organized as a monorepo:

```
oasis-platform/
├── frontend/     Next.js (TypeScript, Tailwind CSS)
├── backend/      Node.js + Express (TypeScript, Clean Architecture)
├── database/     Prisma schema, migrations, seed scripts
├── docker/       Dockerfiles + docker-compose for local/dev/prod parity
├── docs/         Architecture, requirements, API design, roadmap
└── scripts/      One-off ops / maintenance scripts (added from Module 2 onward)
```

## Project status

**Modules 1, 2, 3A, 3B, and 3C are all approved and FROZEN — together the
source of truth for every module going forward.**

Module 2 (Repository Scaffolding, Infrastructure & Auth Module) shipped a
real backend (Express + TypeScript + Prisma) and frontend (Next.js) —
registration, login, JWT auth, password hashing, forgot password, email
verification, RBAC middleware, Swagger docs, structured logging,
validation, error handling, and 77 passing unit tests — then went through a
pre-freeze security verification pass (refresh-token hashing, password
policy, rate limiting, production CORS safety, separate JWT secrets,
request size limits, fail-fast env validation, a Swagger on/off switch,
`/health`) that caught and fixed three real gaps. See
[`docs/07-module-2-notes.md`](docs/07-module-2-notes.md) for the complete
write-up.

**Module 3A (Student Learning Experience): approved and frozen.** Browse/
search/filter courses, course details with full syllabus, enrollment-gated
signed video/note URLs, resumable video playback with progress tracking,
Learning Streak, Continue Watching, Announcements, and Profile — real
backend endpoints (6 new modules, 123 tests total) and a real frontend
(auth forms, Browse Courses, Course Details, Search, Student Dashboard, My
Courses, Course Player, Profile). Went through a pre-freeze verification
pass (progress-percentage clamping, streak anti-inflation, draft/hidden
lecture access, signed-URL expiry, full Swagger coverage) that found and
fixed two real gaps. See
[`docs/08-module-3a-notes.md`](docs/08-module-3a-notes.md) for the
complete write-up.

**Module 3B (Teacher Dashboard & Course Management): approved and
frozen.** Course creation/editing/Draft-Publish-Archive with thumbnail
upload, full content management (chapters/modules/lectures/notes with
numeric move-up/down reordering, signed video/PDF uploads, lecture status
control), quiz authoring, and announcements with student notification
fan-out — 5 new backend modules (203 tests total) and a real
Teacher-facing frontend (Dashboard, My Courses, Create/Edit Course, Course
Builder, Announcements). Caught and fixed a real bug during live testing:
a Swagger JSDoc YAML syntax error that was silently dropping endpoints
from the generated API spec. Went through a pre-freeze verification pass
(cross-teacher ownership on every write, upload-URL generation ordered
strictly after ownership checks, published-only visibility for students)
that confirmed all three were already correctly implemented — no
corrections needed. See
[`docs/09-module-3b-notes.md`](docs/09-module-3b-notes.md) for the
complete write-up.

**Module 3C (Admin Dashboard & Platform Management): approved and
frozen.** Admin Dashboard (counts, recent registrations/announcements),
basic Analytics, Teacher management (add/edit/disable-enable/
reset-password), Student management (disable-enable/reset-password),
read-only Course Oversight (archive/delete only — never chapters/modules/
lectures/quizzes/notes, enforced structurally, not just by convention),
platform-wide Announcements (with a banner visible to every visitor,
including logged-out ones), and Platform Settings (branding, contact
info, logo/favicon upload) — one new backend module (35 tests, 238 total)
and a real Admin-facing frontend. Password reset reuses Module 2's real
forgot-password flow rather than a new mechanism. Went through a
pre-freeze verification pass that found one genuine gap: Platform
Settings had no public read path, so the Navbar, page title, and Home
page were still showing hardcoded "OASIS" literals — fixed with a new
public `GET /settings` endpoint and three frontend consumers wired to it,
each with a live-refreshing (not build-time-frozen) fetch. See
[`docs/10-module-3c-notes.md`](docs/10-module-3c-notes.md) for the
complete write-up.

See also [`CHANGELOG.md`](CHANGELOG.md) for a chronological record and
[`PROJECT_MEMORY.md`](PROJECT_MEMORY.md) for the living, single-source-of-truth
architectural summary every future module should be checked against.

## Where to start reading

| Doc | Purpose |
|---|---|
| [`PROJECT_MEMORY.md`](PROJECT_MEMORY.md) | **Start here** — living summary of every architectural decision, convention, and deferred feature |
| [`CHANGELOG.md`](CHANGELOG.md) | Chronological record of what shipped in each module |
| [`docs/01-srs-and-requirements.md`](docs/01-srs-and-requirements.md) | Software Requirements Specification, functional + non-functional requirements |
| [`docs/02-architecture.md`](docs/02-architecture.md) | System architecture, folder structure, clean-architecture layering, user flows, RBAC, media strategy, observability |
| [`docs/03-database-design.md`](docs/03-database-design.md) | ER diagram, schema rationale, soft-delete policy, indexing strategy |
| [`database/schema.prisma`](database/schema.prisma) | The actual Prisma schema (Module 1 deliverable — not yet migrated/applied) |
| [`docs/04-api-design.md`](docs/04-api-design.md) | REST API design, resource list, conventions, versioning |
| [`docs/05-roadmap-and-milestones.md`](docs/05-roadmap-and-milestones.md) | Module-by-module build plan from here to launch |
| [`docs/06-deployment-and-docker.md`](docs/06-deployment-and-docker.md) | Deployment strategy, Docker setup, environment variables |
| [`docs/07-module-2-notes.md`](docs/07-module-2-notes.md) | Module 2 design decisions, schema addendum, and what was actually built/tested |
| [`docs/08-module-3a-notes.md`](docs/08-module-3a-notes.md) | Module 3A design decisions and what was actually built/tested |
| [`docs/09-module-3b-notes.md`](docs/09-module-3b-notes.md) | Module 3B design decisions and what was actually built/tested |
| [`docs/10-module-3c-notes.md`](docs/10-module-3c-notes.md) | Module 3C design decisions and what was actually built/tested |

## Tech stack (locked for V1)

- **Frontend:** Next.js (latest stable), TypeScript, Tailwind CSS — deployed on Vercel
- **Backend:** Node.js, Express, TypeScript — Dockerized, deployable to Render / Railway / DigitalOcean / AWS / any VPS
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT (access + refresh tokens), email/password, max 2 active devices per account
- **Storage:** Cloudflare R2 — **two buckets**: a private one for lecture videos/notes (signed URLs only) and a public/CDN-fronted one for images (thumbnails, avatars, logo, testimonial photos)
- **Payments:** Razorpay
- **Docs:** Swagger/OpenAPI, auto-generated from route annotations

## Explicitly out of scope for V1

Parent Dashboard, native Android/iOS apps, AI Tutor/Doubt Solver, built-in
video conferencing, discussion forum, real-time chat, and advanced
analytics. `docs/02-architecture.md §9` explains where each plugs in later
without a rewrite.

---

## Getting Started

### Prerequisites
- Node.js 20 LTS
- Docker & Docker Compose (for local Postgres — or point `DATABASE_URL` at
  any Postgres 16+ instance you already have)
- A Cloudflare account with **two** R2 buckets created (one private, one
  public/CDN-fronted) — see `docs/06-deployment-and-docker.md`. Not
  required to run the app locally: without R2 credentials configured,
  signed-URL endpoints return a clear `R2NotConfiguredError` instead of a
  confusing SDK failure (`backend/src/lib/r2.ts`) — everything else works.
- A Razorpay account (test-mode keys — not needed until Module 7)

### 1. Clone and install
```bash
git clone <repo-url> oasis-platform
cd oasis-platform
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```
Fill in real values — see the full reference tables in
`docs/06-deployment-and-docker.md §6`. Never commit either filled-in file.

### 3. Start Postgres
```bash
cd docker
docker compose up postgres -d
```
(Or point `DATABASE_URL` in `backend/.env` at any Postgres 16+ you already
have — the backend itself is easiest to run with `npm run dev`, not
Dockerized, during active development; see `docs/06-deployment-and-docker.md §2`.)

### 4. Run database migrations & seed data
```bash
cd backend
npm run prisma:migrate:dev -- --name init
npm run seed
```
The seed script populates the initial Boards (CBSE, ICSE, State Board),
Class Grades (4–10), Subjects (Mathematics, Science, English), a
placeholder `AcademySettings` row, a demo teacher and student account
(`teacher@oasis.example.com` / `student@oasis.example.com`, both
`Teacher@123` / `Student@123`), two published courses with a full
syllabus, a demo enrollment with partial progress already recorded, and a
starter Learning Streak — enough to actually use the app end to end.

### 5. Run the backend and frontend
```bash
cd backend && npm run dev     # http://localhost:4000, docs at /api/v1/docs
cd frontend && npm run dev    # http://localhost:3000 (separate terminal)
```

### 6. Verify
- Backend health check: `curl http://localhost:4000/health`
- API docs: `http://localhost:4000/api/v1/docs`
- Run the test suite: `cd backend && npm test` (238 tests)
- Frontend: `http://localhost:3000`

---

## Coding Standards

- **TypeScript `strict: true` everywhere** — frontend and backend. No `any`
  without a comment explaining why it's unavoidable.
- **Clean Architecture in the backend** (`docs/02-architecture.md §2`):
  routes are thin, controllers are thinner, business logic lives in
  services, and only the repository layer touches Prisma directly. If a
  controller has an `if` statement deciding *whether* something is allowed
  (not just *how to respond*), that logic belongs in a service.
- **No business logic in the frontend.** Per the architectural invariant in
  `docs/02-architecture.md §10`: the frontend calls the backend API and
  renders results. It does not independently verify payments, compute quiz
  scores, or decide entitlement to content.
- **Naming conventions:** `PascalCase` for React components, TypeScript
  types/interfaces, and Prisma models; `camelCase` for variables and
  functions; `kebab-case` for file names except React component files
  (`CourseCard.tsx`, not `course-card.tsx`).
- **Linting/formatting:** ESLint + Prettier, enforced in CI (from Module 11
  onward) — a PR with lint errors doesn't merge.
- **Tests accompany logic, not just get bolted on at the end:** each module
  that introduces non-trivial business logic (auth, payments, content
  access checks) ships with unit tests for that logic in the same module,
  per the roadmap's milestone exit criteria.
- **Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):**
  `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` — e.g.
  `feat(payments): verify razorpay signature server-side`. This keeps the
  history scannable and sets up automated changelog generation later if
  wanted, at no extra cost now.

---

## Git Branching Strategy

**GitHub Flow** — a single long-lived branch (`main`) that's always
deployable, plus short-lived feature branches:

```
main ──●───────●───────●───────●──────▶  (always deployable; every commit here is releasable)
        \       \       \       \
         feature/auth-jwt
                 feature/payments-razorpay
                         fix/device-limit-race-condition
                                 feature/testimonials-admin-ui
```

- Branch naming: `feature/<short-description>` or `fix/<short-description>`,
  matching the module they belong to where relevant (e.g.
  `feature/module-4-media-upload`).
- Every change lands via a Pull Request — even for a solo/small team, a PR
  is where the Module N "explain design decisions, mention assumptions and
  trade-offs" checklist gets written down and preserved, not just said in
  chat.
- Squash-merge to `main` so history stays one commit per feature, readable
  months later.
- Tag a release (`v0.1.0`, `v0.2.0`, ...) at each module milestone that gets
  deployed, so "what was live when" is always answerable.
- Hotfixes branch directly off `main` (`fix/...`) and merge the same way —
  no separate hotfix process, since there's no long-lived `develop` branch
  to reconcile with.

**Trade-off considered:** full GitFlow (`develop` + `release/*` + `hotfix/*`
branches) was considered and rejected for V1. GitFlow earns its complexity
when multiple versions need to be supported in parallel or releases are
batched and scheduled — neither is true here. The project brief's own
module-by-module, approve-then-proceed workflow is naturally compatible
with GitHub Flow's "small change → PR → merge → deployable" rhythm; adding
GitFlow's extra branches would slow down exactly the incremental delivery
model already chosen.

---

## Deployment

Full detail in [`docs/06-deployment-and-docker.md`](docs/06-deployment-and-docker.md).
Summary: frontend on Vercel, backend as a Docker image on any Docker host
(Render/Railway/DigitalOcean/AWS/VPS — provider chosen at launch, not baked
into the code), managed PostgreSQL, and two Cloudflare R2 buckets (private
video/notes, public/CDN-fronted media).

## Next step

Modules 1, 2, 3A, 3B, and 3C are frozen and are the project's permanent
architecture — every module since builds on the `AuthRepository` pattern,
the middleware pipeline, the error envelope, the env-validation approach,
`optionalAuthenticate`, the two-tier signed-URL TTL convention, the
ownership-assertion-before-every-write pattern, numeric move-up/down
reordering, and the public-`GET /settings`-for-dynamic-branding pattern
established there, rather than redesigning them.
