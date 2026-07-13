# Changelog

All notable changes to the OASIS project are documented in this file,
module by module. Each entry reflects what was *approved and frozen*, not
work-in-progress — see `PROJECT_MEMORY.md` for the living architectural
summary and `docs/` for the full detail behind any entry here.

---

## Module 3C — Admin Dashboard & Platform Management
**Status:** Approved and frozen.

### Pre-freeze verification pass
Five items verified against the actual code and live requests before
freezing. Four were already correctly implemented (RBAC on every admin
route, verified live with real STUDENT/TEACHER tokens against every
endpoint including bypass attempts; the structural cannot-touch-content
guarantee; full Swagger coverage). One was a genuine gap:
- **Platform Settings had no public read path.** `AcademySettings`'s own
  Module 1 schema comment explicitly anticipated "a public GET endpoint
  for the frontend footer/contact page," which the initial Module 3C pass
  never built — only the admin-authenticated `GET/PATCH /admin/settings`
  existed. In practice this meant the Navbar brand text, page `<title>`,
  and placeholder Home page hero were all still hardcoded `"OASIS"`
  literals with nowhere to read Admin's configured values from. Fixed by
  adding a public `GET /settings` (reuses the existing service, no new
  business logic) and wiring the Navbar, root layout metadata (including
  favicon), and Home page to it, each falling back to the prior static
  string only if the fetch fails. Also added a small, purely-additive
  `revalidate` option to the frontend's shared `apiRequest` helper so
  these values refresh every 60 seconds instead of being frozen at build
  time — confirmed in the production build output.

See `docs/10-module-3c-notes.md §7` for the complete write-up.

### Added
- **Backend**, one new `admin` module — Admin Dashboard (counts, recent
  registrations, recent announcements) and basic Analytics; Teacher
  management (add/edit/disable-enable/reset-password); Student management
  (disable-enable/reset-password); read-only Course Oversight
  (archive/delete only — no chapter/module/lecture/quiz/note access,
  structurally, not just by convention); platform-wide Announcements
  (create/edit/delete, plus the one public `GET /announcements/platform`);
  Platform Settings (academy name/full name/tagline/contact/address/
  social links/logo/favicon). 35 new backend tests (238 total).
- **Frontend**: Admin Dashboard, Teachers, Students, Course Oversight,
  Announcements, and Settings pages, behind a new `admin/layout.tsx`
  guard with a simple sub-navigation — same pattern as `student/`/
  `teacher/`. A new `PlatformAnnouncementsBanner`, mounted once in the
  root layout below the Navbar, so platform-wide announcements genuinely
  reach every visitor, including logged-out ones.
- Two additive schema fields on `AcademySettings` (`academyFullName`,
  `faviconId` + a new `favicon` relation to `Media`) — the brief asked
  for both explicitly and neither existed.
- `POST /media` / `DELETE /media/:id` (Module 3B) now also accept `ADMIN`
  alongside `TEACHER` — needed for logo/favicon upload, already
  anticipated by Module 3B's `MediaPurposeValue` having an unused
  `ACADEMY_LOGO` case.
- A demo Admin account added to `database/seed.ts`
  (`admin@oasis.example.com` / `Admin@123`), same pattern as the existing
  demo teacher/student accounts.

### Design decisions of note
- `AdminCourseService` has no dependency on `content-management`'s
  repository at all — "Admin must not edit chapters/modules/lectures/
  quizzes/notes" is enforced by the service literally having no method
  that could reach that content, verified by a dedicated test.
- Password reset reuses Module 2's real `AuthService.forgotPassword` flow
  rather than a new "set password directly" mechanism — a plaintext
  password never transits the Admin API.
- Both `ADMIN` and `SUPER_ADMIN` are accepted on every admin route (the
  brief says "Only ADMIN," but a more-privileged role having at least the
  same access as a less-privileged one is the safer default given
  `SUPER_ADMIN` has no other defined semantics anywhere in the docs).
- "Active Users" (Analytics) is defined as distinct users holding a
  currently-valid refresh token — reuses the existing `RefreshToken`
  table, zero schema changes, rather than adding a `lastLoginAt` field
  for one number.

### Real bugs found
None in this module's own new code — the Module 3B Swagger YAML mistake
was specifically checked against and passed clean on first live boot
(65 path entries, zero parser errors).

See `docs/10-module-3c-notes.md` for the complete write-up.

---

## Module 3B — Teacher Dashboard & Course Management
**Status:** Approved and frozen.

### Pre-freeze verification pass
Three security/correctness items verified against the actual code (and
live requests) before freezing — all three were already correctly
implemented, no corrections needed:
- Ownership checks precede every mutation across all Module 3B services,
  and every controller derives the acting teacher's identity from the
  verified JWT (`req.user!.id`), never from client-supplied IDs — the
  actual IDOR risk this item is about. Verified by inspecting every
  controller method (6 files) and every service's public methods, plus a
  live check that a STUDENT token gets 403 at the RBAC layer on
  representative endpoints.
- Upload-URL generation is confirmed, by exact source line order, to
  happen strictly after ownership verification in both
  `LecturesService` and `NotesService`.
- Only-PUBLISHED-visible-to-students is confirmed still true at the
  query level in Module 3A's frozen `courses.repository.ts` and
  `search.repository.ts` — untouched by Module 3B.

See `docs/09-module-3b-notes.md §7` for the complete write-up.

### Added
- **Backend**, 5 new modules (`media`, `content-management`, `quizzes`,
  `announcements`, plus teacher-write extensions to `courses`) — create/
  edit/Draft-Publish-Archive courses, course thumbnail upload, chapters/
  modules/lectures/notes CRUD with numeric move-up/move-down reordering,
  signed video/PDF upload URLs, lecture status control (Draft/Published/
  Hidden), quiz authoring (questions + options, with validation), and
  announcement CRUD with student notification fan-out. 86 new backend
  tests (203 total).
- **Frontend**: Teacher Dashboard home (basic course statistics, recent
  announcements), My Courses, Create Course, Edit Course (thumbnail
  upload, status controls), Course Builder (the full chapter → module →
  {lectures, notes, quizzes} tree, with inline editing, move-up/down
  reordering, and a dynamic quiz builder), and Announcements management.
- Two new Course-scoped read endpoints added mid-module once the frontend
  actually needed them: `GET /courses/mine/:id` (single course, any
  status, for editing — distinct from Module 3A's public,
  published-only, slug-based `GET /courses/{slug}`) and
  `GET /courses/{id}/content` (the full content tree, every lecture
  status, for the Course Builder).

### Fixed (caught during implementation)
- A Swagger JSDoc description containing literal `{...}` broke YAML
  parsing for an entire route file, silently dropping some of its
  endpoints from the generated OpenAPI spec. Only surfaced by booting the
  server and reading its stdout — `tsc`/lint/tests all stayed green
  through this. Fixed, and re-verified by regenerating the spec and
  confirming the affected endpoint's presence and description.
- A stray `.env` file left over from manual live-testing silently caused
  2 of Module 2's `env.test.ts` cases to stop working correctly (`dotenv`
  refilling a deliberately-deleted variable from disk). Not an application
  bug — a testing-hygiene one, documented in
  `docs/09-module-3b-notes.md §4` so it isn't mistaken for a regression
  later.

### Design decisions of note
- Reordering is numeric move-up/move-down (swap with the adjacent
  sibling), not drag-and-drop — per explicit instruction.
- Uploads are signed-PUT direct-to-R2, never proxied through Express;
  `lib/r2.ts` gained new PUT-signing exports additively (existing GET
  exports untouched), and a new `lib/r2Public.ts` handles the separate
  public/CDN bucket for images.
- Teacher-facing content management is a wholly separate module from
  Module 3A's frozen student-facing `content` module — same schema,
  no shared code.
- Editing a quiz replaces its entire question set rather than supporting
  per-question PATCH — matches how a teacher actually edits a quiz form
  in one submission, and Question/QuestionOption were already designed
  (Module 1) as cascade-deleted structural children of Quiz.

See `docs/09-module-3b-notes.md` for the complete write-up.

---

## Module 3A — Student Learning Experience
**Status:** Approved and frozen.

### Pre-freeze verification pass
Five correctness/security items verified against the actual code and a
live-generated OpenAPI spec (not assumed) before freezing. Two were
already correct (streak same-day protection, full Swagger coverage —
verified empirically against a live-generated spec, 23/23 endpoints
present). Three led to minimal, targeted fixes:
- Course progress percentage now has an explicit `Math.min(100, ...)`
  clamp in `enrollments.service.ts` — belt-and-suspenders on top of an
  already-sound invariant, not dependent on it holding forever.
- **Real gap found:** the public course-detail syllabus query exposed
  DRAFT/HIDDEN lecture titles to anyone (streaming itself was already
  correctly blocked). Fixed by filtering `status: 'PUBLISHED'` at the
  query that builds the syllabus.
- **Real gap found:** signed R2 URLs shared one 10-minute TTL for both
  lecture streaming and note downloads — too short for realistic lecture
  lengths, which would silently break video playback partway through.
  Split into a 4-hour lecture-streaming TTL and a 10-minute note-download
  TTL.

6 new tests (123 total). See `docs/08-module-3a-notes.md §7` for the
complete write-up.

### Added
- **Backend**, 6 new modules (`catalog`, `courses`, `content`, `enrollments`,
  `streak`, `users`, `search`) — Browse/search/filter courses, course
  detail with full syllabus (public, personalizes when logged in and
  enrolled), enrollment-gated signed video/note URLs, lecture progress
  tracking with automatic course-progress computation, Learning Streak
  (UTC-day-boundary counting logic), Continue Watching, Announcements
  aggregation, and profile management. All new routes documented in
  Swagger. New `optionalAuthenticate` middleware (sibling to `authenticate`,
  for routes that personalize but don't require login).
- **Frontend**: `AuthProvider`/`useAuth` (session state, login/register/
  logout, refresh-on-401), a small design-token system, a reusable
  component library, and every page in scope — real Login/Register/
  Forgot-Password forms, Browse Courses, Course Details, Search Results,
  Student Dashboard, My Courses, the Course Player (chapter/module/lecture
  navigation, resumable video, note downloads, progress tracking), and
  Profile.
- `database/seed.ts` extended with demo content: a teacher account, two
  published courses with a full syllabus, a demo student enrollment with
  partial progress, and a starter Learning Streak.
- 40 new backend unit tests (117 total), same mocked-repository pattern as
  Module 2.

### Fixed (caught during implementation)
- `database/seed.ts` couldn't resolve `@prisma/client` at all —
  `database/` is a sibling of `backend/`, not a descendant, so Node
  couldn't find backend's `node_modules`. Fixed with a `NODE_PATH` env var
  in the `seed` script. (This script was written in Module 2 but never
  actually executed until now.)
- `next.config.ts`'s `output: "standalone"` (Module 2) turned out to be
  incompatible with plain `next start` — verified live that it printed a
  warning and never served a request. Fixed by gating standalone output
  behind a `DOCKER_BUILD` env var that only the Docker build sets.
- Two `react-hooks/set-state-in-effect` violations (synchronous `setState`
  at the top of an effect, before an async fetch) — restructured to avoid
  the anti-pattern rather than suppressing the lint rule.

### Design decisions of note
- Course detail (`GET /courses/:slug`) is public with optional
  personalization, not "enrolled-only" as Module 1's original API design
  scoped it — Module 3A's brief explicitly lists "Course Details Page"
  under **Public Website**. Full rationale in
  `docs/08-module-3a-notes.md §3`.
- Course progress is computed on read (lecture counts), not stored as a
  column.
- No enrollment-creation endpoint — Payments isn't built yet; demo
  enrollment is seeded directly, using the nullable-`paymentId` pattern
  Module 1 already designed for Admin/scholarship enrollments.

See `docs/08-module-3a-notes.md` for the complete write-up.

---

## Module 2 — Repository Scaffolding, Infrastructure & Auth Module
**Status:** Approved and frozen.

### Added
- Monorepo scaffolding: `backend/` (Express + TypeScript, Clean Architecture),
  `frontend/` (Next.js 16 App Router + TypeScript + Tailwind v4), `database/`,
  `docker/`.
- Prisma setup wired to `database/schema.prisma`; `database/seed.ts` for
  baseline catalog data (Boards, Class Grades, Subjects, Academy Settings).
- Auth module: registration, login, JWT access/refresh tokens (refresh
  tokens rotated and hashed before storage), bcrypt password hashing (cost
  12), forgot/reset password, email verification with resend, logout /
  logout-everywhere, 2-device login limit enforcement (Strategy A — reject
  the 3rd device).
- RBAC middleware (`requireRole`), ready for the first role-gated route.
- Swagger/OpenAPI docs at `/api/v1/docs`, generated from route JSDoc;
  configurable via `SWAGGER_ENABLED`.
- Structured logging (pino), request-ID correlation, sensitive-field
  redaction.
- Zod-based request validation middleware; centralized error handler with
  a consistent `{ error: { code, message, details? } }` envelope.
- `GET /health` liveness/readiness endpoint with real DB connectivity check.
- Fail-fast environment validation (`config/env.ts`), including a
  production-only safety check that refuses to boot with an unsafe
  `CORS_ORIGIN`.
- 77 passing unit tests across 7 suites (Auth service/validators/utils,
  RBAC middleware, JWT middleware, env validation).
- Frontend scaffolding: route structure (`(public)`, `(auth)`,
  `student/`, `teacher/`, `admin/`), a typed `lib/api-client.ts` (the
  frontend's sole channel to the backend), placeholder pages for every
  role area.

### Schema additions (additive only, on top of the frozen Module 1 schema)
- `User.emailVerifiedAt`, `User.classGradeId`, `User.boardId` (nullable) —
  needed to actually satisfy FR-AUTH-1's "target class/board at
  registration," which Module 1's schema hadn't wired up yet.
- `VerificationToken` model (email verification + password reset tokens,
  single-use, hashed at rest).

### Fixed (caught during implementation, not part of any prior design)
- `docker/backend.Dockerfile` referenced `../database/schema.prisma`, which
  Docker's `COPY` can never reach outside its build context — fixed by
  moving the backend image's build context to the repository root.
- Module 1's frontend folder structure used `(student)/`, `(teacher)/`,
  `(admin)/` as Next.js route groups; groups don't create URL segments, so
  all three dashboards collided at `/dashboard`. Fixed by making them real
  path segments (`student/`, `teacher/`, `admin/`).
- `docker/frontend.Dockerfile` copied `.next/standalone`, which didn't
  exist because `next.config.ts` didn't set `output: "standalone"` — fixed.
- `backend/.env.example` had the wrong variable name
  (`JWT_REFRESH_EXPIRY` instead of `JWT_REFRESH_EXPIRY_DAYS`) and was
  missing several variables that already existed in code.

### Security hardening (pre-freeze verification pass)
- `CORS_ORIGIN` is now validated at startup: the app refuses to boot in
  production if it's still the localhost default or contains a wildcard.
- `JWT_REFRESH_SECRET` is now load-bearing: refresh/verification tokens are
  hashed with HMAC-SHA256 keyed by this secret (previously an unkeyed
  SHA-256 digest, and the secret was declared but unused).
- `SWAGGER_ENABLED` toggle added — docs were previously unconditionally
  mounted with no way to disable them per deployment.

---

## Module 1 — Planning & Architecture (v1.1)
**Status:** Approved and frozen.

### Added
- Software Requirements Specification: functional and non-functional
  requirements for the V1 MVP (`docs/01-srs-and-requirements.md`).
- System architecture: modular monolith, Clean Architecture layering,
  folder structure, RBAC model, key user-flow sequence diagrams, the
  backend-only-business-logic invariant, media strategy (two R2 buckets),
  observability approach (`docs/02-architecture.md`).
- Database design: full ER diagram and schema rationale, including the
  Board→Class→Subject→Chapter→Module hierarchy, soft-delete policy, and
  the Media/Notification/Testimonial/Enquiry/AcademySettings models
  (`docs/03-database-design.md`, `database/schema.prisma`).
- REST API design: resource groups, conventions, versioning
  (`docs/04-api-design.md`).
- Module-by-module roadmap through launch (`docs/05-roadmap-and-milestones.md`).
- Deployment strategy: Vercel (frontend) + Dockerized backend on any host,
  managed Postgres, two R2 buckets, environment variable reference
  (`docs/06-deployment-and-docker.md`).
- Docker scaffolding (`docker-compose.yml`, `backend.Dockerfile`,
  `frontend.Dockerfile`), initial `.env.example` files.

### Revision (v1.0 → v1.1, incorporated before freeze)
Multi-board support (Board as a table, not an enum), Course/Lecture status
enums, SEO-friendly slugs, a repo-wide soft-delete policy, the two-bucket
media strategy, Notifications, Enquiries, Testimonials, Academy Settings,
the explicit backend-only-business-logic invariant, and expanded
observability — all incorporated in this round, all reflected directly in
the docs above (no separate "v1.0" artifacts were kept).
