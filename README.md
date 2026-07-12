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

**Module 1 — Planning & Architecture: v1.1, refined per review, frozen
pending your final approval.** No application code has been written yet, by
design — this module exists to lock down requirements, architecture,
database design, API contracts, and the deployment story *before* a single
line of backend/frontend code is written, so later modules never contradict
earlier decisions.

## Where to start reading

| Doc | Purpose |
|---|---|
| [`docs/01-srs-and-requirements.md`](docs/01-srs-and-requirements.md) | Software Requirements Specification, functional + non-functional requirements |
| [`docs/02-architecture.md`](docs/02-architecture.md) | System architecture, folder structure, clean-architecture layering, user flows, RBAC, media strategy, observability |
| [`docs/03-database-design.md`](docs/03-database-design.md) | ER diagram, schema rationale, soft-delete policy, indexing strategy |
| [`database/schema.prisma`](database/schema.prisma) | The actual Prisma schema (Module 1 deliverable — not yet migrated/applied) |
| [`docs/04-api-design.md`](docs/04-api-design.md) | REST API design, resource list, conventions, versioning |
| [`docs/05-roadmap-and-milestones.md`](docs/05-roadmap-and-milestones.md) | Module-by-module build plan from here to launch |
| [`docs/06-deployment-and-docker.md`](docs/06-deployment-and-docker.md) | Deployment strategy, Docker setup, environment variables |

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

These instructions describe the target workflow from Module 2 onward — the
backend/frontend source doesn't exist yet in Module 1, but this is exactly
how a new contributor will bring the project up once it does.

### Prerequisites
- Node.js 20 LTS
- Docker & Docker Compose
- A Cloudflare account with **two** R2 buckets created (one private, one
  public/CDN-fronted) — see `docs/06-deployment-and-docker.md`
- A Razorpay account (test-mode keys are enough for local development)

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

### 3. Start Postgres + the backend (Docker)
```bash
cd docker
docker compose up --build
```

### 4. Run database migrations & seed data
```bash
cd backend
npx prisma migrate dev --schema=../database/schema.prisma
npx ts-node ../database/seed.ts
```
The seed script populates the initial Boards (CBSE, ICSE, State Board),
Class Grades (4–10), Subjects (Mathematics, Science, English), and a
placeholder `AcademySettings` row.

### 5. Run the frontend
```bash
cd frontend
npm run dev
```
The frontend runs locally (not Dockerized — see
`docs/06-deployment-and-docker.md §2` for why) and talks to the Dockerized
backend via `NEXT_PUBLIC_API_BASE_URL`.

### 6. Verify
- Backend health check: `curl http://localhost:4000/health`
- API docs (once Module 2 scaffolds Swagger): `http://localhost:4000/api/v1/docs`
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

Module 1 (v1.1) incorporates the refinements from your review: multi-board
support, course/lecture status, SEO slugs, soft deletes, a media strategy,
Notifications, Enquiries, Testimonials, Settings, an explicit
backend-only-business-logic invariant, and expanded observability. Once
you confirm this is frozen, Module 2 begins: repository scaffolding, Prisma
migrations against a real Postgres instance, and the authentication module.
