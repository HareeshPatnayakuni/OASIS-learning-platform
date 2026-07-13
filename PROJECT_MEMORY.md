# OASIS — Project Memory

**This file is the single source of truth for how OASIS is built.** Before
starting any module, read this file first. It summarizes every decision
that's been made and frozen — the full reasoning behind each lives in
`docs/`, but this file is what should be checked against before writing new
code, so nothing gets silently redesigned.

Updated after every approved module. Last updated: end of Module 3B.

---

## 1. What OASIS is

An online coaching platform for students in Classes 4–10 (CBSE/ICSE/State
Board), built for a real institute's public launch. Full requirements:
`docs/01-srs-and-requirements.md`.

## 2. Module status

| Module | Status |
|---|---|
| 1 — Planning & Architecture (v1.1) | ✅ Frozen |
| 2 — Repo Scaffolding, Infra, Auth | ✅ Frozen |
| 3A — Student Learning Experience | ✅ Frozen |
| 3B — Teacher Dashboard & Course Management | ✅ Frozen |

Frozen means: don't redesign it. Extend it additively, the way Module 2
added `VerificationToken` to the schema without touching any Module 1
model. If a genuine gap is found (something frozen doesn't support a
requirement it needs to), the fix is additive and gets documented in that
module's notes file (`docs/07-module-2-notes.md`, etc.) — never a silent
rewrite of a frozen decision.

## 3. Tech stack (locked)

- **Frontend:** Next.js 16 (App Router), TypeScript (`strict: true`),
  Tailwind CSS v4. Deployed to Vercel.
- **Backend:** Node.js, Express, TypeScript (`strict: true`). Dockerized,
  host-agnostic (Render/Railway/DigitalOcean/AWS/VPS).
- **Database:** PostgreSQL via Prisma ORM.
- **Auth:** JWT access tokens (short-lived, signed) + opaque random refresh
  tokens (hashed at rest, rotated on use). Email/password. Max 2 active
  devices per account.
- **Storage:** Cloudflare R2 — two buckets (private for video/notes with
  signed URLs; public/CDN-fronted for images).
- **Payments:** Razorpay (not yet built — see §8).
- **Docs:** Swagger/OpenAPI at `/api/v1/docs`, generated from route JSDoc.

## 4. Backend architecture

**Clean Architecture, strictly layered, one direction of dependency:**
```
Route → Middleware (auth → RBAC → validate) → Controller → Service → Repository → Prisma
```
- **Controllers are thin.** Parse request, call service, shape response.
  No business logic, no `if` statements deciding what's *allowed*.
- **Services own business rules** and are the unit-test target.
- **Repositories are the ONLY place that imports `@prisma/client` directly.**
  Services depend on a repository *interface* (e.g. `AuthRepository` in
  `auth.types.ts`), not on Prisma — this is what makes services testable
  with a plain in-memory fake, no database required. Follow this pattern
  for every new module: `<module>.types.ts` (interface + DTOs),
  `<module>.repository.ts` (Prisma implementation), `<module>.service.ts`
  (business logic, depends on the interface), `<module>.controller.ts`
  (thin HTTP layer), `<module>.routes.ts` (Express routes + Swagger JSDoc),
  `<module>.validators.ts` (Zod schemas).

**Architectural invariant — all business logic lives in the backend.**
The frontend (and any future mobile app) is a thin API consumer. No
Next.js Route Handler/Server Action touches Prisma, Razorpay, or R2
directly, or reimplements a rule the backend already enforces. This is
non-negotiable — see `docs/02-architecture.md §10`.

**Error handling:** every intentional error is an `ApiError` (`utils/ApiError.ts`)
with a stable `code` string, HTTP status, and optional `details`. The
central `errorHandler` middleware turns any thrown error into
`{ error: { code, message, details? } }` — never leaks stack traces in
production. Route handlers are wrapped in `asyncHandler` so async errors
reach it automatically.

**Validation:** Zod schemas per module in `<module>.validators.ts`, applied
via the generic `validate({ body, query, params })` middleware. Types are
inferred with `z.infer<>` and exported for controllers to use.

**RBAC:** `requireRole(...roles)` middleware, runs after `authenticate`.
First real usage starts in Module 3 (Auth module itself has no role-gated
routes — everything is public or "any authenticated user").

**Two authentication middlewares, used deliberately differently:**
`authenticate` (Module 2) rejects a request outright if the token is
missing/invalid — use it wherever a token is genuinely required (signed
URLs, profile, progress writes). `optionalAuthenticate` (Module 3A,
`src/middleware/optionalAuthenticate.ts`) never rejects — it populates
`req.user` if a valid token is present and otherwise proceeds as
anonymous. Use it only for routes that behave correctly either way but
personalize when possible (the public Course Details page is the current
example: full syllabus for everyone, `isEnrolled`/progress added on top
for a logged-in enrolled student). Don't reach for `optionalAuthenticate`
as a shortcut around deciding whether a route actually needs
authentication — if in doubt, it needs `authenticate`.

**Logging:** structured JSON via pino, one shared `logger` instance
(`lib/logger.ts`), redacts secrets/tokens/passwords automatically. Request
correlation via `requestId` middleware + `X-Request-Id` header.

**Rate limiting:** `generalRateLimiter` (global, `RATE_LIMIT_*`) plus
narrower limiters for specific abuse-prone endpoint groups
(`authRateLimiter` for Auth, keyed by IP+email; pattern to reuse for any
future public+unauthenticated write endpoint, e.g. Enquiry submission).

**Soft deletes:** `deletedAt` timestamp on content/account entities (User,
Course, Chapter, ContentModule, Lecture, Note, Quiz, Announcement,
LiveClass, Testimonial, Media, Board, ClassGrade, Subject). Repository
reads filter `deletedAt: null` by default. Never applied to
financial/audit records (Payment, Enrollment, QuizAttempt,
LectureProgress) — those are immutable. `Question`/`QuestionOption`
cascade-delete with their parent `Quiz` instead. `Enquiry` uses a status
enum, not soft delete. Full rationale: `docs/03-database-design.md §2.6`.

## 5. Database conventions

- UUID primary keys everywhere (public entities never expose sequential IDs).
- **Board → Class → Subject → Chapter → Module** is the browsing hierarchy;
  `Course` is the sellable unit at the Board+Class+Subject intersection —
  Chapters/Modules nest under `Course`, not directly under Board/Class/Subject.
- `Board`, `ClassGrade`, `Subject` are tables, not enums — new boards
  (e.g. a specific state board) or subjects are data inserts, not schema
  changes.
- `CourseStatus` (DRAFT/PUBLISHED/ARCHIVED) and `LectureStatus`
  (DRAFT/PUBLISHED/HIDDEN) are separate enums — a course can be published
  while an individual lecture is still draft/hidden.
- Slugs: `Course.slug` globally unique; `Chapter.slug` unique per-course
  (chapter titles legitimately repeat across courses).
- Media (images) and video/notes are architecturally different: images go
  through the `Media` model into a public/CDN bucket with a long-lived
  URL; video/notes stay in the private bucket, accessed only via
  short-lived signed URLs. Never conflate the two pipelines.
- **Signed URL TTLs are use-case-specific, not one shared constant**
  (`backend/src/lib/r2.ts`, Module 3A): lecture streaming uses a 4-hour TTL
  (has to survive an entire viewing session, including seek/Range
  requests against the same URL well after the initial one); note
  downloads use 10 minutes (a single-shot request). A single shared TTL
  was tried first and found to silently break video playback partway
  through any lecture longer than ~10 minutes — if a future module adds a
  new signed-URL use case, size its TTL to the actual access pattern, not
  by copying whichever constant is closest.
- **Uploads use the identical signed-URL pattern as downloads, just PUT
  instead of GET** (Module 3B: `lib/r2.ts`'s `getLectureUploadUrl`/
  `getNoteUploadUrl`, and the new `lib/r2Public.ts` for images). The
  backend never receives file bytes — it generates a collision-resistant
  object key server-side (never derived from a client-supplied filename),
  signs a short-lived PUT URL for that exact key, and the browser uploads
  directly to R2. `lib/r2.ts`'s existing GET-signing exports from Module
  3A were extended additively (new functions appended, nothing existing
  changed); `lib/r2Public.ts` is a wholly new file for the public/CDN
  bucket, with its own credentials — never conflate the private
  (video/notes) and public (images) pipelines.
- **Teacher-facing content writes live in a separate module
  (`content-management`) from the student-facing `content` module**
  (Module 3A, frozen) — same Prisma schema, zero shared code. If a future
  module needs both a student read and a teacher write for the same kind
  of resource, this is the established precedent: two modules, not one
  module serving two audiences.
- **Numeric reordering, not drag-and-drop**: every reorderable resource
  (Chapter, ContentModule, Lecture) exposes one `PATCH .../move` endpoint
  taking `{ direction: 'up' | 'down' }`, swapping `order` with the
  immediate sibling (`content-management/reorder.util.ts`'s
  `moveSibling`, shared across all three). If a future resource needs
  reordering, reuse this utility rather than inventing a new scheme.
- **Ownership identity always comes from the verified JWT
  (`req.user!.id`), never from `req.body`/`req.params`.** Every
  Module 3B controller passes `req.user!.id` as the acting teacher's
  identity into its service, and every service asserts that ID actually
  owns the resource (directly, or via the `lib/ownership.ts` traversal
  helpers) before doing anything else. This is the actual IDOR defense —
  a client changing an ID in the URL can change *which resource* it's
  asking about, never *who it's asking as*. Confirmed with a dedicated
  pre-freeze audit (`docs/09-module-3b-notes.md §7`, item 1) that found
  zero exceptions across all 6 Module 3B controllers. Any future module
  accepting a teacher/owner ID from client input instead of the session
  would be a real regression of this guarantee, not a stylistic
  preference — check for it explicitly if reviewing new write endpoints.
- **Content visibility is filtered at the query that serves it, not only
  at the point of finest-grained access.** `GET /lectures/:id/stream-url`
  correctly blocked non-`PUBLISHED` lectures from day one, but the public
  course-detail syllabus query didn't inherit that filter and leaked
  DRAFT/HIDDEN lecture titles until a Module 3A freeze-verification pass
  caught it (`docs/08-module-3a-notes.md §7`, item 3). When adding a new
  read path over content with a status/visibility field, filter it there
  directly — don't assume a downstream endpoint's access check makes an
  upstream listing safe.
- Refresh tokens and verification tokens are never stored raw — only an
  HMAC-SHA256 hash (keyed with `JWT_REFRESH_SECRET`, see §7). The raw
  value exists only in the API response body or the emailed link.

## 6. API conventions

- Base path `/api/v1`. Every route documented with `@openapi` JSDoc in its
  `.routes.ts` file — Swagger is generated from these, not maintained
  separately.
- Success responses: `{ data: ... }`. Errors: `{ error: { code, message, details? } }`.
- Pagination: `?page=&limit=` → `{ data: [...], meta: { page, limit, total } }`.
- Soft-deleted resources 404 by default; `?includeDeleted=true` is an
  Admin-only recovery escape hatch (not yet built — no Admin module exists
  yet).
- Full resource-by-resource design: `docs/04-api-design.md`. Where a new
  module needs an endpoint that doc didn't anticipate (e.g. a learning-streak
  endpoint), add it and document the addition in that module's notes file —
  don't retrofit the frozen doc.

## 7. Auth specifics worth remembering

- Access tokens: JWTs, signed with `JWT_ACCESS_SECRET`, short-lived
  (`JWT_ACCESS_EXPIRY`, default 15m). Stateless verification — no DB hit
  per request (bounded staleness trade-off, documented in
  `middleware/authenticate.ts`).
- Refresh tokens: opaque random strings (NOT JWTs), stored as an
  HMAC-SHA256 hash keyed with `JWT_REFRESH_SECRET`. Rotated on every use
  (single-use). This is what makes `JWT_REFRESH_SECRET` genuinely separate
  from `JWT_ACCESS_SECRET` — it's an HMAC key, not a JWT-signing key.
- 2-device limit: Strategy A — reject a 3rd distinct device outright
  (`DEVICE_LIMIT_REACHED`, 409). Logging in again on an already-known
  device never counts against the limit. `POST /auth/logout-all` is the
  escape hatch until a granular per-device revoke endpoint exists (Users
  module, not yet built).
- Password policy: min 8 chars, at least one letter, one number
  (`auth.validators.ts`).
- Email verification is a **soft gate** — unverified users can still log in
  and use the platform. No code currently checks `emailVerifiedAt` to
  block anything.
- `CORS_ORIGIN` must be a real origin (not the localhost default, not a
  wildcard) or the app refuses to boot when `NODE_ENV=production`.

## 8. Deferred / not yet built (don't assume these exist)

- **Payments module** (Razorpay) — still not built. There is no API that
  creates an `Enrollment` from a real purchase. Where a module needs
  enrolled students to exist for testing, seed them directly
  (`database/seed.ts`), the same way an Admin-granted scholarship
  enrollment would work (`Enrollment.paymentId` is nullable for exactly
  this reason). Confirmed still true as of Module 3B — the Course Details
  page's "Enroll" CTA is a deliberately disabled button, not a broken
  checkout flow.
- **Media module — partially built as of Module 3B.** Image uploads
  (signed PUT direct-to-R2, public/CDN bucket) now work for course
  thumbnails: `POST /media` (`backend/src/modules/media/`) +
  `backend/src/lib/r2Public.ts`. `Course.thumbnailId` is populated when a
  teacher uploads one. Still not built: avatar upload UI, academy logo,
  testimonial photos — the pipeline supports all of these
  (`MediaPurposeValue` already has cases for them), just no caller exists
  yet for anything except `COURSE_THUMBNAIL`.
- **Admin functionality is still not built** (Module 3B built Teacher, not
  Admin) — no user management, no cross-teacher moderation, no payment
  records UI, no platform-wide settings UI.
- **Teacher functionality is now built** (Module 3B): course authoring,
  content management (chapters/modules/lectures/notes/quizzes), and
  announcements. A demo teacher account exists (`database/seed.ts`) and
  can now actually use a real dashboard, not just serve as an FK target
  for seeded courses.
- **Quizzes can now be authored** (Module 3B: create/edit/delete, with
  question/option validation) **but not yet attempted.** There's no
  student-facing "take this quiz" flow — `QuizAttempt` exists in the
  schema for when that's built, but nothing writes to it yet.
- **Notifications: the Announcement fan-out is now built** (Module 3B —
  posting an announcement creates a `Notification` row per enrolled
  student, per the original design in `docs/02-architecture.md §6.1`).
  Still not built: any UI for a student to browse/mark-read their
  Notifications specifically (separate from the Announcements list they
  already see via `GET /users/me/announcements`, Module 3A) — that's a
  small, self-contained addition whenever it's wanted.
- Parent Dashboard, native mobile apps, AI Tutor, built-in live classrooms,
  discussion forum, advanced analytics, assignments, attendance,
  certificates, scheduling — out of V1 scope entirely, see
  `docs/02-architecture.md §9` for their extension points.

## 9. Frontend conventions

- Route structure: `(public)/` and `(auth)/` are true Next.js route
  groups (their children have distinct paths, so grouping is safe).
  `student/`, `teacher/`, `admin/` are **real path segments**, not route
  groups — Next.js route groups don't create URL segments, and three
  `dashboard/page.tsx` files under parenthesized groups previously
  collided at the same `/dashboard` path (fixed in Module 2, see
  `docs/07-module-2-notes.md §4`).
- `src/lib/api-client.ts` is the only file that talks to the backend.
  Components/pages call it (or, for authenticated calls, go through
  `useAuth().authFetch`/`authFetchPaginated` — see below); they never
  `fetch()` the backend directly. Two response shapes: `apiRequest<T>()`
  for `{ data }`, `apiRequestPaginated<T>()` for `{ data: [...], meta }`.
- **Session/auth: `AuthProvider` (`src/components/AuthProvider.tsx`) +
  `useAuth()` (`src/hooks/useAuth.ts`), added in Module 3A.** Tokens live
  in `localStorage` (`src/lib/auth-storage.ts`), not cookies — consistent
  with the "JWT in headers only" API design. `useAuth()` exposes `user`,
  `isAuthenticated`, `isLoading`, `login`/`register`/`logout`, and
  `authFetch`/`authFetchPaginated` (attaches the current access token,
  retries once after a silent refresh on a 401). Any new authenticated
  page/component uses `authFetch`, not `apiRequest` directly. Pages under
  `student/` are guarded by `src/app/student/layout.tsx`, which redirects
  to `/login` if not authenticated — a UX convenience only; the backend
  independently enforces `requireRole('STUDENT')` regardless.
- **Design tokens** (Module 3A): brand indigo + accent amber, defined once
  in `src/app/globals.css`'s `@theme inline` block (`--color-brand-*`,
  `--color-accent-*`, `--color-success-*`) and used via Tailwind utilities
  (`bg-brand-600`, `text-accent-600`, etc.) — don't pick a new ad hoc color
  for a new component; extend the token set if a real new need arises.
- **Reusable component library**, `src/components/`: `ui/` (Button, Badge,
  ProgressBar, Loading/States — generic, no domain knowledge), `course/`
  (CourseCard, CourseFilterBar, CourseSyllabus, VideoPlayer — course-domain,
  reused across Browse/Detail/Player), `student/` (StreakBadge,
  AnnouncementList). Check here before writing a new one-off component.
- No business logic in the frontend — enforcement, entitlement, and
  computed business values (e.g. course-unlock status) come from the API
  response, never re-derived client-side.
- System font stack (no `next/font/google`) — avoids an external font-CDN
  dependency; see `src/app/layout.tsx`.
- `output: "standalone"` in `next.config.ts` is gated behind a
  `DOCKER_BUILD` env var (Module 3A fix) — it's incompatible with plain
  `next start`, which is what a developer runs locally. Only
  `docker/frontend.Dockerfile` sets `DOCKER_BUILD=true`. Don't remove this
  gate without re-testing `npm start` locally afterward.

## 10. Coding standards

- TypeScript `strict: true` everywhere, no unexplained `any`.
- ESLint (`@typescript-eslint/recommended-requiring-type-checking`) +
  Prettier, enforced per-package (`backend/.eslintrc.cjs`,
  `frontend/eslint.config.mjs`).
- Naming: `PascalCase` for components/types/Prisma models, `camelCase` for
  variables/functions, `kebab-case` filenames except React components.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.).
- Git: GitHub Flow (`main` always deployable, short-lived feature
  branches, squash-merge, tag releases at module milestones). Full
  rationale for rejecting GitFlow: root `README.md`.
- Tests accompany the logic that introduces them, not bolted on later.
  Services get unit tests against a hand-written in-memory fake repository
  (see `backend/tests/unit/auth/fakeAuthRepository.ts` as the template) —
  this pattern is required for every new module's service layer, not
  optional. Middleware gets direct unit tests with mocked
  req/res/next. Zod schemas get edge-case tests (boundary values, not just
  happy path). **Frontend: no component/hook tests exist yet** (flagged as
  a gap in `docs/08-module-3a-notes.md §5`, not silently skipped) — if
  that changes, `AuthProvider`'s refresh-on-401 logic is the highest-value
  starting point.

## 11. Known sandbox limitation (not a code issue)

`prisma generate`/`migrate` cannot run in the development sandbox used to
build this project — `binaries.prisma.sh` isn't reachable from it. All
Prisma-facing code is still written normally and will work immediately
with `npm install && npx prisma migrate dev` in any real environment.
Business logic is validated via the mocked-repository unit-testing pattern
above, which doesn't depend on a real Prisma client at all. Full detail:
`docs/07-module-2-notes.md §6`.

## 12. Environment variables

Full reference: `backend/.env.example` (kept in sync with
`backend/src/config/env.ts` — if they ever drift, `.env.example` is wrong,
not the code). Every variable is validated at startup; the process exits
with a clear error if something required is missing or malformed
(`config/env.ts:loadEnv()`).
