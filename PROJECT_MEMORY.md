# OASIS — Project Memory

**This file is the single source of truth for how OASIS is built.** Before
starting any module, read this file first. It summarizes every decision
that's been made and frozen — the full reasoning behind each lives in
`docs/`, but this file is what should be checked against before writing new
code, so nothing gets silently redesigned.

Updated after every approved module. Last updated: Module 4B (Payment
Management), complete and pending approval, following Module 4A (see
`CHANGELOG.md`). Modules 1, 2, 3A, 3B, 3C, 3D, and 4A are frozen.

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
| 3C — Admin Dashboard & Platform Management | ✅ Frozen |
| 3D — Branding & UI Identity | ✅ Frozen |
| 4A — Payments Foundation | ✅ Frozen |
| 4B — Payment Management | 🚧 Complete, pending approval |

**Tagged `v0.1.0` — Foundation Complete** (`backend/package.json` and
`frontend/package.json` both set to `0.1.0`). This is the first version
tag on the project, marking the point where a complete, real-machine
verification (Windows 11, Docker, an actual browser — not just this
sandbox's own build/test/lint) passed end-to-end across every surface.

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
- **Payments:** Razorpay (test mode), core purchase/verify flow built
  Module 4A — see §8 for what's still deferred (webhooks, refunds,
  invoices, coupons, etc.).
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

**ADMIN routes accept both `ADMIN` and `SUPER_ADMIN`** (Module 3C,
`requireRole('ADMIN', 'SUPER_ADMIN')`) — `SUPER_ADMIN` has existed in the
`UserRole` enum since Module 1 with no defined behavior anywhere; a
more-privileged role having at least the access a less-privileged one
does is the reasonable default, not a restriction. Follow this pairing
for any future Admin-scoped route rather than `requireRole('ADMIN')` alone.

**Prevent an entire category of write by removing the dependency, not
just by checking permissions** (Module 3C, `AdminCourseService`): "Admin
must not edit chapters/modules/lectures/quizzes/notes" is enforced by
`AdminCourseService` having no dependency on `content-management`'s
repository at all — there's no method that could reach that content, not
a permission check guarding one that exists. When a future module has a
hard "must never be able to X" requirement, prefer this shape (make X
impossible to call) over a runtime check (make X return 403) wherever the
two are equally natural — it fails safe even against a future bug in the
check itself. Verified with a dedicated "structural guarantee" test
(inspects the service's own method list) rather than only a behavioral one.

**Reuse existing security-sensitive flows instead of building parallel
ones** (Module 3C: `AdminTeacherService`/`AdminStudentService`'s password
reset composes Module 2's real `AuthService.forgotPassword` directly,
rather than adding a new "set password directly" mechanism). If a new
module needs to trigger something a frozen module already does correctly
and securely, import and call that module's exported class rather than
reimplementing a parallel version — it's both less code and avoids a
second, less-tested path to the same sensitive outcome.

**Adding a second relation to an already-related model requires explicit
`@relation` names on both sides, retroactively** (Module 3C: adding
`AcademySettings.favicon → Media` alongside the existing
`AcademySettings.logo → Media` required naming both relations explicitly,
since Prisma can't infer which is which once there are 2+ relations
between the same two models). This is the one case where an *existing*
field's annotation (not its type, nullability, or behavior) has to change
as the minimal necessary consequence of an additive schema change — expect
this same requirement any time a new relation is added to a model that
already relates to the same target model somewhere else.

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

**External-service `lib/` wrappers all follow one pattern** (`lib/r2.ts`
Module 3A, `lib/razorpay.ts` Module 4A): build the client lazily from
env vars that are `.optional()` at the schema level, so the app boots
fine without that service configured; return `null`/skip if unconfigured;
throw a dedicated `XNotConfiguredError` only at the point something
actually tries to use it, with a message naming the exact env vars
needed. Use this same shape for any future external service integration
rather than making its credentials hard-required at startup.

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
- **Any write that must update two tables together as one logical
  outcome needs a real Prisma transaction — a genuine gap was found and
  fixed here, not a hypothetical.** `PaymentService.verifyPayment`
  originally called `markPaymentSuccess` (writes `Payment`) and
  `createEnrollment` (writes `Enrollment`) as two separate calls; a
  crash between them could leave a payment marked `SUCCESS` with no
  enrollment — a paying student with no access, invisible until someone
  specifically went looking. Fixed with
  `PaymentRepository.markPaymentSuccessAndEnroll`, using
  `prisma.$transaction([...])` (the array form; reach for the
  interactive callback form `$transaction(async (tx) => ...)` only if a
  later step genuinely needs to read an earlier step's result — this
  case didn't). When a future module has a "write A, and only if A
  succeeds also write B, as one atomic outcome" requirement, this is the
  template — don't assume two sequential repository calls are good
  enough just because each one individually succeeds most of the time.

## 6. API conventions

- Base path `/api/v1`. Every route documented with `@openapi` JSDoc in its
  `.routes.ts` file — Swagger is generated from these, not maintained
  separately.
- Success responses: `{ data: ... }`. Errors: `{ error: { code, message, details? } }`.
- Pagination: `?page=&limit=` → `{ data: [...], meta: { page, limit, total } }`.
- Soft-deleted resources 404 by default; `?includeDeleted=true` is
  documented as a future Admin-only recovery escape hatch — still not
  built as of Module 3C. That module built discrete Admin management
  endpoints (list/archive/delete teachers/students/courses/announcements),
  not a generic query-param override on every existing endpoint; the two
  are different features and shouldn't be conflated.
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

- **Payments module — core purchase/verify flow built (Module 4A)**:
  `POST /courses/:courseId/purchase` and `POST /payments/verify` are
  real, working endpoints; a real purchase now creates a real
  `Enrollment`. **Still genuinely not built**, explicitly out of scope
  for 4A: coupons, discounts-as-a-system (the existing `discountPrice`
  field is honored as the effective charge amount, but there's no
  customer-facing promo-code mechanism), wallet, subscriptions, refunds,
  invoices (`Payment.invoiceUrl` exists in the schema but nothing
  populates it), GST, email/SMS receipts, payment analytics, webhooks
  (`RAZORPAY_WEBHOOK_SECRET` exists in config but nothing reads it —
  Checkout's client callback + server-side signature verification is
  the only completion path right now, so a closed browser tab mid-payment
  leaves a `PENDING` row with no automatic resolution), and an Admin
  finance dashboard. See `docs/13-module-4a-notes.md` for the full
  design writeup. Admin-granted scholarship enrollment (seeding an
  `Enrollment` directly with no `Payment`) is still the pattern for
  tests/seed data that need an enrolled student without exercising the
  real purchase flow — `Enrollment.paymentId` stays nullable for exactly
  this reason.
- **Media module — image uploads now cover course thumbnails (Module 3B)
  and academy logo/favicon (Module 3C)**: `POST /media` (`backend/src/modules/media/`)
  + `backend/src/lib/r2Public.ts`, now accepting both `TEACHER` and
  `ADMIN`. Still not built: avatar upload UI, testimonial photos — the
  pipeline supports these too (`MediaPurposeValue` already has cases for
  them), just no caller exists yet.
- **Admin functionality is now built** (Module 3C): Admin Dashboard,
  basic Analytics, Teacher management (add/edit/disable-enable/reset-password),
  Student management (disable-enable/reset-password), read-only Course
  Oversight (archive/delete only — never chapters/modules/lectures/quizzes/notes,
  structurally, not just by convention — see §4), platform-wide
  Announcements, and Platform Settings. A demo Admin account exists
  (`database/seed.ts`: `admin@oasis.example.com` / `Admin@123`). Still not
  built: cross-teacher content moderation, any Admin self-registration
  flow (Admin accounts are provisioned directly, never self-registered —
  matches how the demo account is seeded).
- **Teacher functionality is built** (Module 3B): course authoring,
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
- **Role-scoped area layouts all follow the same guard shape**
  (`student/layout.tsx`, `teacher/layout.tsx`, `admin/layout.tsx` — the
  last added in Module 3C): redirect to `/login` if unauthenticated, show
  a plain message if authenticated but the wrong role, otherwise render.
  `admin/layout.tsx` additionally renders a small sub-navigation tab bar
  (Dashboard/Analytics/Teachers/Students/Courses/Announcements/Settings) —
  reuse that tab-bar shape for any future area with more than ~4 sibling
  pages under one role-gated section, rather than inventing a new nav
  pattern per area.
- **One global banner, not one per dashboard** (Module 3C:
  `PlatformAnnouncementsBanner`, mounted once in the root layout below
  the Navbar): when something needs to be visible to literally every
  visitor regardless of role or auth state, mount it once at the root
  rather than duplicating the same fetch across student/teacher/admin
  dashboards. This was also the one place Module 3C touched a Module 3A
  frozen file (`app/layout.tsx`) — a single self-contained
  import-and-render addition, not a change to anything existing in it.
- **`Footer` component** (Module 3D, `src/components/Footer.tsx`):
  mounted once in the root layout below `{children}`, same
  mount-once-at-root pattern as `PlatformAnnouncementsBanner` and the
  Navbar. Shows academy name/tagline/contact/social links from
  `GET /settings`, with the logo image and the same fallback pattern
  described above.
- **Academy branding (name/full name/tagline/logo/favicon) always comes
  from `GET /settings` (public), never a hardcoded literal** (Module 3C,
  fixed during pre-freeze verification — see
  `docs/10-module-3c-notes.md §7` item 3). Client Components use the
  `usePlatformSettings()` hook (`src/hooks/usePlatformSettings.ts`);
  Server Components call `apiRequest('/settings', { revalidate: 60 })`
  directly (see the root `layout.tsx`'s `generateMetadata()` and the
  Home page for the pattern). Every consumer falls back to a static
  string (`"OASIS"` etc.) only if the fetch fails — that's a resilience
  fallback, not permission to hardcode the value as the primary source.
  If a future page shows academy branding, use one of these two patterns
  rather than a new literal string.
- **`lib/api-client.ts`'s `RequestOptions` has an optional `revalidate`
  passthrough** (Module 3C addendum — purely additive, every existing
  caller is unaffected since it's `undefined` unless explicitly passed):
  set this on any server-side `apiRequest`/`apiRequestPaginated` call
  for data that changes occasionally and shouldn't be frozen at build
  time by Next's default fetch caching. Without it, a static page that
  fetches once at build time never sees updates until the next deploy.
- **Design tokens**: the same `--color-brand-*`/`--color-accent-*`/
  `--color-success-*` token scheme established in Module 3A, but the
  actual colors were replaced in Module 3D with the official OASIS brand
  palette (Deep Navy `#0B1D3A`, Bright Blue `#1E5BFF`, Fresh Green
  `#22C55E`) — `brand-600`/`brand-900`/`accent-500` are these exact hex
  values, unmodified; every other shade in the ramp is a mathematically
  derived tint/shade of them, not invented separately. Defined once in
  `src/app/globals.css`'s `@theme inline` block, used via Tailwind
  utilities (`bg-brand-600`, `text-accent-600`, etc.) — don't pick a new
  ad hoc color for a new component; extend the token set (deriving from
  the same 3 official colors) if a real new need arises. Never hardcode
  a hex value or reach for a stock Tailwind color (`blue-600`,
  `green-500`, etc.) directly — Module 3D found and fixed exactly one
  place this had happened.
- **Reusable component library**, `src/components/`: `ui/` (Button, Badge,
  ProgressBar, Loading/States — generic, no domain knowledge), `course/`
  (CourseCard, CourseFilterBar, CourseSyllabus, VideoPlayer — course-domain,
  reused across Browse/Detail/Player), `student/` (StreakBadge,
  AnnouncementList). Check here before writing a new one-off component.
- No business logic in the frontend — enforcement, entitlement, and
  computed business values (e.g. course-unlock status) come from the API
  response, never re-derived client-side.
- **Typography**: official brand fonts (Poppins for headings, Inter for
  body — Module 3D), self-hosted via `next/font/local` in `layout.tsx`,
  pointed directly at the real `.woff2` files shipped inside the
  installed `@fontsource/poppins`/`@fontsource/inter` npm packages —
  same actual font files either way, applied globally to `h1`–`h6` via
  `--font-heading` and to `body` via `--font-sans` in `globals.css` (both
  now reference the `next/font/local`-generated CSS variables
  `var(--font-poppins)`/`var(--font-inter)`, set on `<html>` via each
  font's `.variable`). This replaced Module 3A's original system-font
  choice, then a `@fontsource` plain-CSS-`@import` approach that itself
  had to be replaced — **confirmed via a real launch on Windows 11** that
  raw `@import "@fontsource/poppins/400.css";` in `globals.css` throws
  `CssSyntaxError: Can't resolve` under Next.js 16 + Turbopack: Turbopack's
  CSS parser doesn't resolve `@import` into deep `node_modules` subpaths
  the way Webpack did (a genuine, currently-open Turbopack limitation,
  confirmed via multiple tracked upstream issues, not a project bug).
  `next/font/local` sidesteps this because it's Next's own native font
  pipeline (never a raw CSS `@import`), while still using the exact same
  self-hosted `.woff2` files — verified end-to-end after switching
  (production build, dev server, and the served font file itself all
  confirmed working). If a future page needs a font, use the existing
  `--font-sans`/`--font-heading` tokens — don't add a third typeface
  without updating the Branding Package source of truth first, and don't
  reintroduce a raw `@import` of an npm package's CSS in `globals.css`
  (same Turbopack limitation would resurface).
- **Logo assets**: real, extracted PNG files under
  `frontend/public/brand/` (Module 3D) — see
  `docs/11-module-3d-notes.md §8` for the full inventory and which crop
  is used where. Every placement follows the same fallback pattern:
  `settings?.logoUrl ?? '/brand/oasis-logo-....png'` — an Admin-uploaded
  logo (Module 3B/3C's existing Platform Settings upload flow) takes
  priority automatically; the static files are what a fresh,
  unconfigured install shows. Use this exact pattern for any new page
  that needs to show the logo, rather than hardcoding just the static
  path (which would ignore a configured custom logo) or just the dynamic
  one (which would show nothing on a fresh install).
- **`Branding/` at the repository root is the permanent Master Branding
  Package** (Module 3D) — the single source of truth for brand identity,
  colors, typography, and logo usage rules across *every* future OASIS
  product (web, mobile, brochures, certificates, social, banners), not
  just this codebase. `frontend/public/brand/`'s files are a subset of
  what's in `Branding/Logos/`, copied there specifically for the web app
  to serve them. If the two ever disagree, `Branding/` is authoritative —
  check `Branding/Brand-Guidelines/Logo-Usage.md §7` for every asset's
  exact provenance (direct crop vs. resize vs. disclosed composition)
  before adding a new one anywhere.
- `output: "standalone"` in `next.config.ts` is gated behind a
  `DOCKER_BUILD` env var (Module 3A fix) — it's incompatible with plain
  `next start`, which is what a developer runs locally. Only
  `docker/frontend.Dockerfile` sets `DOCKER_BUILD=true`. Don't remove this
  gate without re-testing `npm start` locally afterward.
- **The app is always light-themed — it deliberately does not follow
  `prefers-color-scheme`.** `globals.css` has no dark-mode media query,
  and there are no `dark:` Tailwind variants anywhere in the codebase;
  don't reintroduce either. This was a real, reported bug, not a style
  preference: a previous dark-mode override flipped `body`'s inherited
  text color to near-white while several inputs' explicit light
  backgrounds stayed put, making typed text genuinely invisible (the
  Admin Settings page and the Platform Announcement textarea both hit
  this for real). **Any `<input>`/`<textarea>` should set its own
  explicit text color** (`text-neutral-900` or similar) rather than
  relying on inherited body color — most of the existing `inputClass`
  definitions across `admin/*` pages do this now; a couple of
  older ones (`admin/courses`, `admin/students`, `admin/teachers`,
  `teacher/courses/*`) still rely on inheritance, which is currently
  safe only because the theme itself no longer varies — don't treat that
  as license to skip an explicit color on a new one.
- **Never nest an interactive element (`<button>`, or a component that
  renders one, like `EditableTitle` or `Button`) inside a `<button>`.**
  Invalid HTML — browsers auto-correct nested buttons in
  parser-dependent, unpredictable ways, so this isn't just a console
  warning, it's a real risk of inconsistent click/keyboard behavior
  across browsers (confirmed as a real, reported bug in the Teacher
  Course Builder's chapter row). If a row needs to be clickable *and*
  contain its own inner interactive controls (a title that's separately
  editable, action buttons, etc.), make the row a `<div role="button"
  tabIndex={0} onClick={...} onKeyDown={...}>` instead of a `<button>` —
  this is the standard ARIA pattern for exactly this case, and preserves
  identical click behavior, Enter/Space keyboard activation, and
  screen-reader semantics. Add `event.stopPropagation()` inside the
  inner control's own handler so activating it doesn't also fire the
  row's handler.
- **A Server Component page that needs to know per-user state it can't
  read server-side (auth lives in localStorage, not a cookie — see the
  note above) gets a thin Client Component wrapper for just that piece,
  not a full page conversion.** `components/course/CourseGrid.tsx`
  (Module 4B) is the template: the Browse Courses page stays a Server
  Component doing its normal server-side fetch of the public course
  list; `CourseGrid` is the one small client boundary that
  additionally fetches the *requesting student's own* enrollments
  (`GET /enrollments/me`, already existing) and cross-references by ID
  to show a "Purchased" badge. Anonymous visitors and non-students see
  the exact same page as before, since the wrapper does nothing extra
  for them.
- **No admin sub-page (courses, teachers, students, settings,
  announcements, payments) has an in-app navigation link anywhere —
  confirmed by checking directly, not assumed.** They're all reachable
  only by direct URL today. This was true before Module 4B and Module
  4B didn't change it — don't add a nav link for one admin page without
  also addressing the others, since doing it for just one would be
  inventing a new, inconsistent pattern rather than following an
  existing one. (Student-facing pages are different: the Navbar already
  has a real "Profile" link precedent, which Module 4B's "My Payments"
  link correctly followed.)

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
- **Tests must assert on the actual response *shape*, not just
  filtering/counting behavior — a real bug shipped past this gap.**
  `listAnnouncementsForTeacher` had a test confirming it filtered by
  author correctly, but nothing ever asserted that `course`/`author`
  were present and correctly nested — the endpoint had shipped returning
  only flat `courseId`/`authorId` strings, silently missing the nested
  display data the frontend actually renders, and this passed 238 tests
  the whole time. When a repository method's return type includes
  relation data a frontend will display (not just IDs used for logic),
  write at least one test that asserts on that nested shape specifically
  — a passing "only returns mine" test is not evidence the shape is right.
- **Any Admin lifecycle action with an inverse (archive ↔ restore, etc.)
  should mirror its counterpart's shape exactly at every layer** —
  repository method, service method (including the same
  assert-exists-first pattern), controller handler, route + Swagger doc,
  and tests. See `admin.repository.ts`'s `archiveCourse`/`restoreCourse`
  as the template. `restoreCourse` deliberately restores to `DRAFT`, not
  back to `PUBLISHED` — an archived course becoming publicly visible
  again is a Teacher's conscious call via their own existing Publish
  action, never an automatic side effect of an Admin action.
- **`package.json` scripts must never use shell-specific syntax**
  (env-var-assignment prefixes like `VAR=value cmd`, `&&` chains relying
  on a specific shell's semantics, etc.) — this project is meant to set
  up on Windows Command Prompt/PowerShell as well as bash/zsh/sh, and
  shell syntax is exactly where those diverge. If a script genuinely
  needs to set an environment variable or do anything more than "run
  this one command with these args," write a small `.js` file under
  `backend/scripts/` using Node's own `child_process`/`path` APIs (see
  `backend/scripts/run-seed.js` for the template — this is the same
  technique the `cross-env` package uses internally, reimplemented
  directly rather than adding a dependency for something this small) and
  point the `package.json` script at `node scripts/that-file.js`. See
  `docs/12-cross-platform-notes.md` for the full incident this pattern
  fixed (the `seed` script failed outright on Windows before this).

## 11. Known sandbox limitation (not a code issue)

**This sandbox has no Docker, no real browser, and no network path to
Google's font CDN or `binaries.prisma.sh`.** Three genuine bugs
(`courses.repository.ts`'s enum typing, `token.util.ts`'s actual file
location, `globals.css`'s font `@import`) were only ever found through an
actual Windows 11 + Docker + browser launch, not through any amount of
reasoning or structural verification possible here — in one case
(`token.util.ts`), an earlier investigation in this project's history
concluded a real-environment bug report was mistaken, based on a
structural analysis that turned out to be checking the wrong ground
truth. **When a concrete, reproduced report from a real launch conflicts
with this sandbox's own reasoning, the real report wins** — this sandbox
can rule things in (a fix compiles, tests pass) far more reliably than
it can rule things out (a passing build here does not mean the same
build passes for real, e.g. against a real generated Prisma Client or a
real Turbopack CSS resolution pass).

`prisma generate`/`migrate` cannot run in the development sandbox used to
build this project — `binaries.prisma.sh` isn't reachable from it. All
Prisma-facing code is still written normally and will work immediately
with `npm install && npx prisma migrate dev` in any real environment.
Business logic is validated via the mocked-repository unit-testing pattern
above, which doesn't depend on a real Prisma client at all. Full detail:
`docs/07-module-2-notes.md §6`.

**Concrete, confirmed consequence (found via a real Docker build, not
hypothetically):** the local stub types every model delegate as `any`
(e.g. `course: any`), so it cannot catch type errors that only exist
against Prisma's real, precisely-typed generated client. One such error
actually surfaced this way: `courses.repository.ts`'s `listPublishedCourses`
built its `where` clause as an intermediate `const where = { status:
'PUBLISHED', ... }` (needed for conditional filter spreading) — assigning
an object literal to a `const` first, rather than passing it inline,
widens `status` to plain `string`, which the real `CourseWhereInput`
rejects. **`satisfies` on just the `status` property alone is not
sufficient to fix this** — it was tried first and confirmed not to work,
because the widening happens at the level of the *containing object
literal's* own type inference, not the individual property expression;
`satisfies` on one property doesn't protect it from the object literal
around it. **The fix that actually works: type the whole `where` object
explicitly** — `const where: Prisma.CourseWhereInput = {...}` — which
gives every property real contextual typing from Prisma's actual input
type, same as an inline argument would. Both the failure mode and the
fix were verified in isolation (a standalone reproduction outside the
actual codebase) to confirm the mechanism precisely, not just that the
real file happened to compile. The local Prisma stub
(`node_modules/.prisma/client/default.d.ts`) was extended with a
representative `Prisma.CourseWhereInput` type to make this properly
testable — this stub file is local sandbox tooling only, replaced
entirely by real generated types via `prisma generate` in any real
environment. **Any new repository method that builds a `where`/`data`
object incrementally (rather than as one inline literal) and includes an
enum field must type the whole object explicitly with the real Prisma
input type** (`Prisma.XWhereInput`/`Prisma.XCreateInput`/etc.) — not a
per-property `satisfies`, which looks like it should work but doesn't.
Every other existing occurrence of an enum status literal in the
codebase was checked and confirmed to be passed inline (safe); this was
the one exception.

## 12. Environment variables

Full reference: `backend/.env.example` (kept in sync with
`backend/src/config/env.ts` — if they ever drift, `.env.example` is wrong,
not the code). Every variable is validated at startup; the process exits
with a clear error if something required is missing or malformed
(`config/env.ts:loadEnv()`).

**Any genuinely-optional numeric env var must use `optionalPositiveIntEnv()`
(or the same preprocess-empty-to-undefined pattern), never a bare
`z.coerce.number().int().positive().optional()`.** Confirmed via a real
launch: a present-but-blank value (`SMTP_PORT=`, exactly what's left
after removing a placeholder from a template `.env`) coerces through JS's
`Number('')`, which is `0`, not `NaN` — so it fails `.positive()` with a
confusing error even though `.optional()` is right there on the schema.
`.optional()` only skips validation for a *missing* key, not a
*present-but-empty* one. `SMTP_PORT` was the reported case; the same
helper should be used for any new optional numeric var, and the same
`booleanEnv()` pattern already in this file solves the identical problem
for optional booleans.
