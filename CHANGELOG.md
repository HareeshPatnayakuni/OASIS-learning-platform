# Changelog

All notable changes to the OASIS project are documented in this file,
module by module. Each entry reflects what was *approved and frozen*, not
work-in-progress — see `PROJECT_MEMORY.md` for the living architectural
summary and `docs/` for the full detail behind any entry here.

---

## Module 6 — Student Quiz Attempt Flow
**Status:** Complete, pending approval.

Completes quiz functionality Module 3B only built the teacher-authoring
half of: students can now take a quiz, get a server-scored result, and
view their most recent attempt. Zero schema changes.

### Key finding, confirmed before writing any code
`QuizAttempt` has `@@index([quizId, studentId])` but no unique
constraint, and its own schema comment calls it an "immutable historical
record" — the schema was never built to enforce a single attempt.
**Attempt policy chosen: multiple attempts allowed**, each submission a
new row, "my attempt" returns the most recent. The simplest behavior
consistent with the existing schema, not invented from scratch.

### Added
- **Backend**: new `modules/quizzes/quiz-attempts.*` (student-facing,
  alongside the existing teacher-facing `quizzes.*`) —
  `GET /quizzes/:quizId/attempt` (quiz with no correct answers exposed),
  `POST /quizzes/:quizId/attempt` (server-scored submission — the score
  is always computed from the real answer key, never trusted from the
  request, which has no score field to send one in), and
  `GET /quizzes/:quizId/my-attempt` (most recent attempt, or null).
  Reuses `QuizRepository.findQuizById` (the teacher module's existing
  read path) directly for quiz structure and
  `ContentRepository.isStudentEnrolled` (Module 3A/4A's existing
  enrollment check) directly for access — no duplicated logic.
- **Quizzes added to the course syllabus** (`courses.repository.ts`),
  inheriting the existing course-status check that query already
  performs — Quiz has no status field of its own (confirmed in
  `docs/03-database-design.md §2.3`), so this was the correct and only
  way to gate its visibility.
- **Frontend**: a quiz is now reachable directly from the existing
  Course Player sidebar (`CourseSyllabus`, one new rendering branch
  alongside notes) — no separate quiz dashboard. New Take Quiz/Result
  page handles the form, a fresh submission's per-question correctness,
  and a previous attempt's aggregate score, with a Retake option.

### Security
Every submitted `questionId`/`optionId` is validated against the actual
quiz's structure before scoring, rejecting anything that doesn't belong
— the literal enforcement of "students cannot submit answers for another
quiz." Correct answers are compile-time-absent from the pre-submission
response type, not just omitted by convention. A student's "my attempt"
query is scoped by `studentId` at the database query itself, never
filtered after a broader fetch.

Verified: 291 backend tests (14 new), `tsc`, lint, and build pass on
both packages. All three new endpoints live-tested for correct RBAC
(Teacher `403`) with zero collision against the existing teacher
`GET /quizzes/:id` endpoint, and confirmed present with zero parser
errors in the live OpenAPI spec (77 paths, up from 75).

See `docs/16-module-6-notes.md` for the complete write-up.

---

## Module 5 — Device Management
**Status:** Approved and frozen.

### Pre-freeze review
One focused check before freeze: what happens to an already-issued
access token belonging to a device that gets removed? Confirmed
directly from `middleware/authenticate.ts` — access tokens are verified
statelessly (JWT signature + expiry only, no database lookup, no
`deviceId` in the payload), so a removed device's access token remains
valid for up to `JWT_ACCESS_EXPIRY` (15 minutes) after removal, though
it can never be refreshed past that point since the refresh token is
already revoked. Accepted as-is — this is the identical, already-documented
trade-off this codebase already uses for account deactivation, not a new
gap. No code changed. See `docs/15-module-5-notes.md §5` for the full
reasoning.

The 2-active-device login limit was already substantially built in
Module 2 — this module completes it: a My Devices page, the ability to
remove a specific other device, and a real, confirmed bug fix for
"expired sessions no longer count as active."

### The confirmed bug
`countDeviceSessions` counted every `DeviceSession` row unconditionally,
with no awareness of whether its refresh token had actually expired. A
student who let a session expire naturally (closed the tab, never
explicitly logged out) stayed locked at their device limit forever,
since nothing ever removed the stale row. Fixed with a shared
`getValidDeviceIds` helper — a device only counts if it has an
unexpired, unrevoked refresh token — used by both the login-time limit
check and the new device list, so the two can never disagree about
what's "active." No scheduled cleanup job: stale sessions are deleted
opportunistically the next time anyone lists their devices.

### Added
- **Backend**: `GET /devices` (list, newest-active-first, current device
  marked) and `DELETE /devices/:deviceId` (revokes every refresh token
  for that device *and* deletes its session, always together — never
  one without the other). Both available to any authenticated role
  (Student, Teacher, Admin) — the 2-device limit already applied
  identically to all of them before this module. New
  `modules/devices/` is routing-only; both endpoints delegate directly
  to `AuthService` (Module 2), with no duplicated authentication logic
  and no separate repository.
- **`AuthService` gains two new methods** (`listMyDevices`,
  `removeDevice`) — additive; every existing method's behavior is
  unchanged for existing callers.
- **Frontend**: My Devices page (`/student/devices`) — device list,
  Remove button (hidden for the current device), a native `confirm()`
  dialog before removal (matching this codebase's existing pattern for
  destructive actions), empty state, loading state, and a retry-capable
  error state. Added to the Navbar alongside the existing My Payments/
  Profile links.
- **Database**: `DeviceSession.browser` and `DeviceSession.operatingSystem`
  — two new nullable columns, additive, so the My Devices page can show
  Browser and Operating System as genuinely separate fields rather than
  re-parsing the existing combined `deviceLabel` string. `deviceLabel`
  itself is unchanged.
- **`parseDeviceLabel.ts` renamed to `parseDeviceInfo.ts`** — now returns
  `{label, browser, operatingSystem}` instead of a single string. One
  caller, updated alongside it.

### Security
Removing a device always revokes its tokens and deletes its session
together — never one without the other, closing the gap where a removed
device could keep a still-usable refresh token, or a revoked-but-not-deleted
session could keep counting against the limit. "Cannot remove the
current device" is checked before the target device is even looked up.
Device-limit enforcement's normal-case behavior (reject a genuine 3rd
device, never auto-evict an existing one) is completely unchanged —
confirmed by the full existing Module 2 test suite still passing
unmodified.

Verified: 277 backend tests (13 new), `tsc`, lint, and build pass on
both packages. Both new endpoints live-tested as reachable by Student,
Teacher, and Admin tokens alike (confirming the role-agnostic design)
and confirmed present with zero parser errors in the live OpenAPI spec
(75 paths, up from 73). All frontend pages, including the new one,
live-checked at `200` with zero error-boundary indicators.

See `docs/15-module-5-notes.md` for the complete write-up.

---

## Module 4B — Payment Management
**Status:** Complete, pending approval.

Read-only visibility into payments for students and admins. No changes
to Module 4A's purchase/verify flow, transaction, or idempotency
guarantees — this module only adds new read queries against the
existing `Payment` table. No schema changes at all.

### Added
- **Backend**: `GET /payments/me` and `GET /payments/me/:paymentId`
  (Student, ownership-scoped at the query level — a student requesting
  another student's payment gets the same 404 as a nonexistent one).
  `GET /admin/payments` (search by student name, search by course,
  filter by status, newest first) and `GET /admin/payments/:id` (Admin).
  Admin oversight built in `modules/admin/` via a new
  `AdminPaymentService`, mirroring Module 3C's `AdminCourseService`
  pattern exactly — no write methods at all, matching "no editing, no
  deleting, no refunds."
- **Frontend**: My Payments (table, newest first), Payment Details
  (read-only field list), and Admin Payment Management (table with two
  independent search inputs plus a status filter) pages. A "Purchased"
  badge on the Browse Courses grid for already-enrolled courses — a
  genuine gap, not just wiring up an existing check: that grid showed a
  raw price for every course with zero enrollment awareness. New
  `CourseGrid.tsx` client wrapper fetches the student's own enrollments
  once (via the existing `GET /enrollments/me`) and cross-references by
  course ID, since the Browse Courses page is a Server Component with no
  access to the client-held auth token.
- **Payment Method and Transaction ID were honestly omitted** from the
  My Payments list — the brief itself hedged both ("if stored"/"if
  applicable"), and neither is actually stored (`Payment` has no payment
  method field; there's no third "transaction ID" concept beyond the two
  Razorpay IDs already in the schema). Adding a new field to satisfy an
  optional, hedged requirement would have violated "modify schema only
  if absolutely necessary."
- **No nav link was added for the admin payments page** — checked
  directly first: no existing admin sub-page has one either, they're all
  URL-only today. A student-side Navbar link *was* added for "My
  Payments," since that mirrors the existing "Profile" link precedent.

Verified: 268 backend tests (26 new), `tsc`, lint, and build pass on
both packages. All four new endpoints live-tested for correct RBAC
(Teacher and Student both `403` from Admin payment routes; Teacher `403`
and anonymous `401` from Student payment routes) and validation; all
three new frontend pages return `200` with zero error-boundary
indicators; confirmed present with zero parser errors in the live
OpenAPI spec (73 paths, up from 69).

See `docs/14-module-4b-notes.md` for the complete write-up.

---

## Module 4A — Payments Foundation
**Status:** Approved and frozen.

### Final review fix
One genuine data-consistency gap found during final review, before
freeze: marking a payment `SUCCESS` and creating its enrollment were two
separate, non-atomic writes — a crash or dropped connection between them
could leave a payment marked `SUCCESS` with no corresponding enrollment
(a paying student with no access). Fixed by combining both into one
`PaymentRepository.markPaymentSuccessAndEnroll` method backed by a
single `prisma.$transaction`, with the enrollment write changed to an
`upsert` (closing a narrow concurrent-double-callback race at the same
time). Added one regression test explicitly asserting this happens
through one atomic call, not two. 256 backend tests total (was 255), all
passing. See `docs/13-module-4a-notes.md §2` for the full write-up and
`CHANGELOG.md`'s freeze verification report (in the conversation record)
for the complete category-by-category audit.

Razorpay TEST-mode payments: a free course enrolls a student
immediately with no Razorpay involvement at all; a paid course goes
through Razorpay Checkout, verified server-side (signature checked
against the secret key, which never leaves the backend) before any
Enrollment is created. Builds on schema groundwork Module 1 already laid
down — `Payment` model, `PaymentStatus` enum, `Enrollment.paymentId`,
and even the Razorpay env vars all already existed; the one real gap
found and fixed was `Payment.courseId` having no actual `@relation` to
`Course` (a loose string with no enforced foreign key).

### Added
- **Backend**: complete `payments` module (types, repository, service,
  controller, validators, routes) — `POST /courses/:courseId/purchase`
  (the single entry point; decides free-vs-paid server-side, every
  time) and `POST /payments/verify` (never trusts the frontend's
  "success" claim; verifies the Razorpay signature server-side using
  the SDK's own verification helper before creating the Payment success
  record or the Enrollment). `backend/src/lib/razorpay.ts` (new),
  mirroring `lib/r2.ts`'s exact lazy-client/`NotConfiguredError` pattern.
  Two additive methods (`findEnrollment`/`createEnrollment`) on the
  previously read-only `enrollments` module — idempotent by
  construction, so a duplicated callback or double-click can never
  create two enrollments.
- **Frontend**: `frontend/src/lib/razorpay.ts` (new — loads the
  Checkout script, typed `window.Razorpay`). `CourseDetailClient.tsx`'s
  purchase button, previously a permanently-disabled placeholder,
  rewritten with the real flow: free → instant enroll; paid → Razorpay
  Checkout with loading/error/cancelled states and an immediate,
  reload-free transition to "Continue Learning" on success.
- **Database**: `Payment.course` relation + `Course.payments` back-relation
  (fixing the missing foreign key) and a new `@@index([userId, courseId])`.
  Everything else in the `Payment`/`Enrollment` models is unchanged.
- **Seed data**: a third demo course, free (`price: 0`), so both
  enrollment paths are exercisable locally without real Razorpay
  credentials.

### Security
Secret key never exposed to the frontend (only the public `keyId` is
returned). Server-side signature verification on every payment, using
Razorpay's own SDK helper. Ownership-checked verification (a student can
only verify their own payment). Duplicate-callback-safe and
duplicate-enrollment-safe by construction (idempotent `createEnrollment`,
backed by the pre-existing `@@unique([studentId, courseId])`
constraint). Course status/price re-validated server-side on every
purchase attempt, never trusted from a stale frontend.

### Confirmed unchanged
Lecture/note access control (`ContentService.isStudentEnrolled`, Module
3A) required no changes at all — it already checks the same
`Enrollment` table this module writes to, fresh on every request. Zero
lines of the content module were touched.

Explicitly out of scope, not implemented: coupons, discounts-as-a-system,
wallet, subscriptions, refunds, invoices, GST, promo codes, email/SMS
receipts, analytics, webhooks, an Admin finance dashboard, international
payments.

Verified: 256 backend tests (14 new), `tsc`, lint, and build pass on
both packages. Live-tested RBAC and validation on both new endpoints;
confirmed present with zero parser errors in the generated OpenAPI spec.
React Query and React Hook Form (named in the task's tech stack) were
deliberately not introduced — no existing usage anywhere in the
codebase, and a single button with no multi-field form doesn't warrant
two new dependencies.

See `docs/13-module-4a-notes.md` for the complete write-up.

---

## v0.1.0 — Foundation Complete
**Status:** Frozen. Modules 1, 2, 3A, 3B, 3C, and 3D are now permanent.

The first version tag on the project, following the first complete,
successful real-machine verification (Windows 11 + Docker + real browser)
covering every surface: Docker/PostgreSQL/backend/Swagger, all three
dashboards, Settings, Announcements, Course archive/restore,
Authentication, Branding, and the light theme. Both `package.json`
`version` fields set to `0.1.0` to match.

### Packaging concern investigated
A report that a delivered zip contained `teacher/layout.tsx`'s content in
place of `app/layout.tsx` (causing `useAuth must be used within
<AuthProvider>`, since the real root layout — and the `AuthProvider` it
mounts — would never render). Investigated directly rather than assumed
fixed: extracted the exact previously-delivered zip and diffed its
`app/layout.tsx` against the working tree — **they were identical, and
both correct** (the real root layout: `Metadata`/`Viewport` exports,
`AuthProvider`/`Navbar`/`Footer`/`PlatformAnnouncementsBanner`, no
role-specific logic). All four `layout.tsx` files (`app/`, `student/`,
`teacher/`, `admin/`) were re-confirmed to have distinct content
(checksummed) with no cross-contamination. Whatever produced the
symptom on the reporting machine, it wasn't present in the artifact this
project actually produced — noted here rather than silently claimed
"fixed" for a defect that couldn't be reproduced in the delivered output.

### Fixed
- **`<button>` nested inside `<button>`** — the Teacher Course Builder's
  chapter row wrapped `EditableTitle` (which renders its own `<button>`
  when not in edit mode) inside an outer `<button>` used to
  toggle the chapter's expanded/collapsed state. Invalid HTML, and
  browser HTML-parsing auto-correction of invalid nested buttons means
  the actual click/keyboard behavior was likely unpredictable across
  browsers even before the console warning was noticed. Fixed by
  replacing the outer `<button>` with a `<div role="button" tabIndex={0}
  onKeyDown={...}>` — the standard, MDN/ARIA-documented pattern for a
  non-button element that needs to behave exactly like one (same click
  behavior, same Enter/Space keyboard activation, same tab-stop, same
  screen-reader announcement as a button) — and added
  `event.stopPropagation()` inside `EditableTitle`'s own button handler
  so clicking the title to edit it doesn't also toggle the row (a no-op
  for `EditableTitle`'s other three usages — module/lecture/note titles
  — which were never wrapped in a clickable row to begin with, and were
  confirmed to have never had this issue). Confirmed this was the only
  occurrence of the pattern anywhere in the codebase before fixing it.
  Styling, click behavior, and keyboard accessibility all preserved
  exactly; only the underlying element type changed.

Verified: full 242-test backend suite, `tsc`, lint, and build pass on
both packages; live-checked every page on the verification list (Home,
Login, Register, Forgot Password, Browse Courses, Student/Teacher/Admin
Dashboard, Teacher Courses, Admin Settings/Announcements/Courses) — all
`200`, zero error-boundary indicators.

---

## Maintenance — Final Stabilization Pass (Second Real Launch Round)
**Status:** Complete. Not a feature module — no application behavior changed.

Five genuine issues found during a second real, hands-on testing round on
Windows 11. Two were substantive backend/frontend defects; three were the
same systemic root cause.

1. **Teacher Dashboard crash — a genuine backend gap, not frontend
   fragility.** `GET /announcements/mine`'s query
   (`announcements.repository.ts`) only ever selected flat `courseId`/
   `authorId` strings — it never selected the nested `course`/`author`
   objects the shared `AnnouncementList` component (used by both the
   Student and Teacher dashboards) actually renders
   (`announcement.course.title`, `announcement.author.fullName`). The
   student-facing equivalent (`users.repository.ts`) already did this
   correctly — Module 3B's teacher-facing endpoint was the one built
   without it, and it had zero test coverage checking the returned
   shape, which is exactly why this shipped. Fixed by adding a
   `course: { select: {...} }`/`author: { select: {...} }` select to
   `listAnnouncementsForTeacher`, with a new `TeacherAnnouncementListItem`
   type separate from the CRUD methods' existing flat `AnnouncementRecord`
   (which still only needs flat IDs for ownership checks). Added the
   missing regression test. Also hardened the frontend component with
   optional chaining and a fallback (`announcement.course?.title ??
   'Platform'`) as defense-in-depth, since "the page should never crash
   because one nested object is missing" is a reasonable invariant on its
   own, independent of this specific bug.
2. **Admin Settings "not functioning" and 4. the Announcement textarea
   showing invisible white-on-white text shared one root cause with 5,
   the default dark theme.** Both pages' text inputs use a shared
   `inputClass` pattern with an explicit light border but no explicit
   text color, relying on inheriting `body`'s text color — which a
   `prefers-color-scheme: dark` media query in `globals.css` flipped to
   near-white while those inputs' backgrounds stayed light. The Settings
   page, being almost entirely text inputs, was the page where this was
   most disruptive; the Announcement textarea was the most visible
   single instance.
3. **Added course restore.** Admin could archive a course but never
   un-archive one. Added `PATCH /admin/courses/:id/restore`, mirroring
   `archive`'s exact shape at every layer (repository, service,
   controller, route, tests) — restores to **Draft**, not straight back
   to Published, so a teacher makes the conscious call to republish via
   their own existing action rather than a course silently becoming
   public again as a side effect of an Admin restore. Rejects restoring
   a course that isn't currently archived. Added a "Restore" button to
   the admin Course Oversight table, shown only for archived courses.
5. **Default theme changed from auto (OS-following) to always-light.**
   Removed the `@media (prefers-color-scheme: dark)` override in
   `globals.css` (the actual root cause of #2 and #4) and the one
   `dark:` Tailwind variant in the codebase (Home page). Also applied a
   small defensive hardening directly to the Settings and Announcement
   pages' shared input styling (explicit `bg-white text-neutral-900`),
   on top of the root-cause fix, since those were the two pages
   explicitly reported as broken.

Verified live end-to-end (not just build/lint/test): booted backend and
frontend together and checked every page from the verification list —
Home, Login, Register, Forgot Password, Browse Courses, Student/Teacher/
Admin Dashboard, Admin Settings, Admin Announcements, Admin Courses — all
return `200` with zero error-boundary indicators in the rendered HTML.
Live-tested the new restore endpoint (reaches business logic with an
Admin token, correctly `403`s for a Teacher token, documented in the live
OpenAPI spec) and the fixed teacher announcements endpoint (reaches
business logic without a validation error). Full 242-test backend suite
(4 new tests: 1 announcement-shape regression, 3 restore), `tsc`, lint,
and `npm run build` all pass on both packages.

---

## Maintenance — Launch Stabilization (First Real Windows 11 Launch)
**Status:** Complete. Not a feature module — no application behavior changed.

Four genuine issues found during the first complete, real end-to-end
launch on Windows 11 (Docker, real Prisma generation, real browser) —
none of these were reproducible in the sandbox this project is built in,
which has no Docker, no browser, and no network path to Google's font
CDN. See `PROJECT_MEMORY.md §11` for the broader lesson this confirmed:
a real, reproduced report from an actual launch overrides this sandbox's
own structural reasoning when the two conflict.

1. **`token.util.ts` moved to its actual correct location,
   `src/utils/token.util.ts`** (grouped with the other small, standalone
   utilities already there, rather than nested inside the auth feature
   module). An earlier investigation in this project's history concluded
   the file belonged at `src/modules/auth/token.util.ts` and that no file
   existed at `src/utils/` — **that conclusion was wrong**, confirmed by
   an actual successful local Docker build after moving it. Import fixed
   to `'../config/env'` (one level, correct here); every cross-reference
   updated to match — `auth.service.ts`, the test file, and two
   explanatory comments in `env.ts` and `lib/jwt.ts`.
2. **`SMTP_PORT` no longer crashes startup when left blank.** A
   present-but-empty env var (`SMTP_PORT=`, exactly what's left after
   removing a placeholder value, exactly as `.env.example` documents as
   valid) coerces through JS's `Number('')` — which is `0`, not `NaN` —
   so it failed `.positive()` even though the field is already
   `.optional()`. `.optional()` only skips validation for a genuinely
   missing key, not a present-but-blank one. New `optionalPositiveIntEnv()`
   helper in `config/env.ts` (same pattern the file's existing
   `booleanEnv()` already uses for the identical class of problem)
   treats blank the same as absent.
3. **Font loading fixed: `next/font/local` instead of a raw CSS
   `@import`.** `globals.css`'s `@import "@fontsource/poppins/400.css";`
   (etc.) — which Module 3D adopted specifically to avoid `next/font/
   google`'s network dependency — throws `CssSyntaxError: Can't resolve`
   under Next.js 16 + Turbopack. Confirmed as a genuine, currently-open
   Turbopack limitation (multiple tracked upstream issues: Turbopack's
   CSS parser doesn't resolve `@import` into deep `node_modules`
   subpaths the way Webpack did), not a project bug or a problem with
   `@fontsource`'s files. Fixed by switching to `next/font/local`
   (Next's own native, self-hosted font loader) pointed directly at the
   same real `.woff2` files already shipped inside the installed
   `@fontsource/poppins`/`@fontsource/inter` packages — same actual
   font files, same zero-external-dependency property, just loaded
   through Next's font pipeline instead of a plain CSS `@import`.
   Verified end-to-end: production build succeeds under Turbopack, dev
   server boots cleanly, the generated `@font-face` rules and font
   variable classes are present in the real output, and the actual
   `.woff2` file serves correctly (`200`, `font/woff2`).
4. **Removed the obsolete `version: "3.9"` field from
   `docker/docker-compose.yml`** — harmless, but Compose V2 infers the
   schema from the file itself and warns on every run if this legacy
   field is present.

Verified: full 238-test backend suite, `tsc`, lint, and `npm run build`
all pass; frontend production build and dev server both verified live,
including the Home page's logo/branding and font classes rendering
correctly in the actual served HTML. Docker itself still isn't available
in this sandbox, so `docker compose build --no-cache`/`up -d` couldn't be
run directly here — please verify those on your end as planned.

---

## Maintenance — Build Stabilization (Real Prisma Client Compile Errors)
**Status:** Complete. Not a feature module — no application behavior changed.

Fixed a genuine TypeScript compile error that surfaced when building in
Docker against a *real*, generated Prisma Client (this sandbox's local
stub types every model delegate as `any`, so it cannot catch errors that
only exist against Prisma's actual precise types — see
`PROJECT_MEMORY.md §11` for the full explanation, including a concrete,
provable reproduction of the exact bug and confirmation of the fix using
an isolated test).

- **`src/modules/courses/courses.repository.ts`** — `listPublishedCourses`
  built its `where` clause as an intermediate `const where = { status:
  'PUBLISHED', ... }` (needed for conditional filter spreading). **A first
  attempt fixed this with `status: 'PUBLISHED' satisfies CourseStatus` on
  just that one property — this was insufficient and confirmed not to
  work**: `satisfies` on a single property doesn't stop the *containing*
  object literal's own inference from widening `status` back to plain
  `string`, since the widening happens at the level of the whole object
  literal being assigned to an untyped `const`, not the individual
  property expression. **Corrected fix:** the entire `where` object is
  now explicitly typed as `Prisma.CourseWhereInput` (`const where:
  Prisma.CourseWhereInput = {...}`), which gives every property —
  `status` included — real contextual typing from Prisma's actual input
  type, the same way an inline argument would. Verified both the original
  bug and this corrected fix in isolation, outside the actual codebase,
  to confirm the mechanism precisely rather than assuming the fix
  compiling was enough on its own. The one other occurrence of a status
  literal built the same way (an intermediate `const`) doesn't exist
  elsewhere — every other status/enum literal in the codebase is passed
  inline as a direct call argument, re-confirmed against the same
  (now more complete) local Prisma type stub used for this fix.
- **`token.util.ts` / `Cannot find module '../../config/env'`** —
  ***correction, superseding the note below***: a previous investigation
  here concluded the codebase's only `token.util.ts` lived at
  `src/modules/auth/token.util.ts` and that no file existed at
  `src/utils/token.util.ts`. **That conclusion was wrong for the real,
  ground-truth project** — confirmed by an actual successful local
  Docker build after moving the file. The file genuinely belongs at
  `src/utils/token.util.ts` (grouped with the other small, standalone
  utilities already there — `ApiError.ts`, `asyncHandler.ts` — rather
  than nested inside the auth feature module for a function with no
  other auth-specific dependency). Moved accordingly; import fixed to
  `'../config/env'` (one level, correct for this location, not two).
  Every cross-reference updated to match: `auth.service.ts`'s import,
  the test file's import, and two explanatory comments in `env.ts` and
  `lib/jwt.ts` that pointed at the old path.

Verified: full 238-test backend suite, `tsc`, lint, and `npm run build`
(the exact command Docker's `RUN npm run build` executes) all pass.
Docker itself isn't available in this sandbox, so `docker compose up -d`
couldn't be run directly — verified the equivalent underlying commands
instead.

---

## Maintenance — Cross-Platform Development Compatibility
**Status:** Complete. Not a feature module — no application behavior changed.

Fixed `backend/package.json`'s `seed` script, which used
bash/zsh/sh-only syntax (`NODE_PATH=./node_modules tsx ...`) and failed
outright on Windows Command Prompt/PowerShell with `'NODE_PATH' is not
recognized as an internal or external command`.

**Root cause:** `database/seed.ts` is a sibling of `backend/`, not a
descendant, so Node can't resolve `backend/node_modules`' packages
(`bcrypt`, `@prisma/client`) from it without help — `NODE_PATH` is the
right mechanism, but the previous fix set it using shell-only syntax.

**Fix:** a new `backend/scripts/run-seed.js` (~30 lines, zero new
dependencies — only Node's built-in `node:path`/`node:child_process`)
sets `NODE_PATH` programmatically via `child_process.spawnSync`'s `env`
option instead of shell syntax, then runs the seed script through it.
`backend/package.json`'s `seed` script is now
`"node scripts/run-seed.js"` — a plain command with no shell-specific
syntax at all, so Command Prompt, PowerShell, bash, zsh, and sh all run
it identically. No `NODE_PATH` configuration or `package.json` editing
required from anyone after cloning; `npm run seed` is unchanged from the
user's perspective. No README.md changes needed (the command it
documents didn't change). Verified: full 238-test backend suite,
`tsc`, lint, and build all pass unmodified; `npm run seed` re-tested
live and reaches the exact same result as before the fix, with a
correctly-propagated exit code.

See `docs/12-cross-platform-notes.md` for the complete write-up.

---

## Module 3D — Branding & UI Identity
**Status:** Approved and frozen.

### Pre-freeze verification pass
Four items verified against the actual code and live requests before
freezing — no corrections needed for any of them (branding consistency
across every page, browser title/favicon/manifest/OG/email/Navbar/
Footer/auth pages, Platform Settings override-with-fallback on every
touchpoint, and zero backend/schema/API changes — confirmed both by the
full 238-test suite passing unmodified and by file-modification-time
analysis showing `lib/email.ts` as the only backend file touched). See
`docs/11-module-3d-notes.md §9`.

### Added: Master Branding Package
A permanent `Branding/` package now lives at the repository root — the
single source of truth for all future OASIS branding (web, mobile,
brochures, certificates, social, banners). Includes Brand Identity,
Color Palette (with computed WCAG contrast ratios), Typography, Logo
Usage (with complete per-file provenance disclosure), and Spacing
Guidelines documents, plus the full asset set organized into `Logos/`,
`Favicons/`, and `Social/` folders. Three additional real extractions
(monochrome icon dark/light, single-color navy icon, monochrome
wordmark) were found and pulled from the source boards using the same
pixel-boundary method as every other asset; three assets
(`OASIS-Logo-Monochrome.png`, `Cover-Image.png`, `LinkedIn-Banner.png`)
are explicitly disclosed as compositions of real, unaltered pieces
rather than direct crops. See `docs/11-module-3d-notes.md §10` for the
complete write-up.

Presentation-only module: no backend logic, database schema, API
contract, or business rule changed — confirmed by running the full,
unmodified backend test suite (238 tests) after every edit, and by a
file-modification-time audit (see the verification pass below).

### Pre-freeze verification pass
Four items verified against the actual code and live requests before
freezing — all four were already correctly implemented, no corrections
needed: no placeholder branding anywhere (grepped for stock colors and
hardcoded brand text — zero matches outside disclosed fallbacks); browser
title/favicon/manifest/OG/Twitter/email/Navbar/Footer/auth pages all
confirmed live; every `logoUrl`/`faviconUrl` usage site follows the
correct dynamic-with-fallback pattern; zero backend changes confirmed via
the full 238-test suite plus a file-modification-time audit showing
`lib/email.ts` as the only backend file touched, with a clear time gap
before it.

### Added — Master Branding Package
A permanent `Branding/` folder now lives at the repository root — the
single source of truth for all future OASIS branding across every
product (web, mobile, brochures, certificates, social, banners). Five
guideline documents (Brand Identity, Color Palette with computed WCAG
contrast ratios, Typography, Logo Usage with complete per-file
provenance, Spacing Guidelines) plus organized asset folders (`Logos/`,
`Favicons/`, `Social/`). Three additional real extractions (monochrome
icon dark/light, single-color navy icon, monochrome wordmark black/gray)
were found in the source boards and pulled out using the same
pixel-boundary method as every other asset. Three assets are disclosed
compositions (a monochrome full-logo lockup, a Cover Image, and a
LinkedIn Banner) — each explicitly labeled as a composition of real,
unaltered pieces rather than a direct crop, per `Branding/Brand-Guidelines/Logo-Usage.md §7`.
No `.svg` vector files are included — none were ever supplied in the
source material, and auto-tracing was deliberately not attempted (see
`docs/11-module-3d-notes.md §1` for why).

See `docs/11-module-3d-notes.md §9–10` for the complete write-up.

### Added — Everything else this module shipped
- **Official OASIS brand palette** applied throughout
  (`frontend/src/app/globals.css`): Deep Navy `#0B1D3A`, Bright Blue
  `#1E5BFF`, Fresh Green `#22C55E`, and Teal `#14B8A6` are the exact,
  unmodified brand hex values; every other shade in the UI's color ramp
  is a mathematically-derived tint/shade of those, not a separately
  invented color.
- **Official typography** — Poppins (headings) + Inter (body),
  self-hosted via `@fontsource` (real font files as npm packages, not
  `next/font/google`, which hard-fails in this sandbox with no network
  path to Google's font CDN).
- **The actual logo image**, mechanically extracted from the uploaded
  Branding Package via precise pixel-boundary detection (not a redrawn
  or recolored approximation — see `docs/11-module-3d-notes.md §1` for
  the method), now appears in the Navbar, Footer, Home page hero, Login,
  Register, and Forgot Password pages, the browser favicon (real
  16/32/48px multi-resolution `.ico`), the Apple touch icon, and the PWA
  manifest icons. Every placement falls back to these official static
  files but gives priority to an Admin-uploaded logo via Platform
  Settings, when one exists.
- **New Footer component**, mounted once in the root layout, showing
  academy name/tagline/contact email/phone/social links — all from the
  same public `GET /settings` the rest of the app already uses, never
  hardcoded.
- **Metadata**: Open Graph and Twitter Card fields, a `viewport` export
  setting `theme-color` to the official Deep Navy, `metadataBase` (fixing
  a real Next.js build warning), and a new dynamic `manifest.ts` (didn't
  exist before) — all reading from Platform Settings with the official
  static values as fallback.
- **Email templates** (`backend/src/lib/email.ts`) — verification and
  password-reset emails now use the official tagline and brand colors
  (Deep Navy header, Bright Blue buttons/links), applied as literal
  confirmed values rather than a live Settings fetch (deliberate — see
  Design decisions below).

### Fixed (caught during implementation)
- A stray Tailwind stock color (`text-blue-600`) bypassing the brand
  token system on the Home page.
- Inconsistent tagline capitalization ("Learn From Home" vs. the official
  "Learn from Home") across `database/seed.ts`, the Home page fallback,
  and `README.md`.
- A real WCAG accessibility shortfall: the text color derived from Fresh
  Green for status messages only reached 3.14:1 contrast against white
  (below the 4.5:1 AA minimum). Computed and verified a darker shade
  (5.01:1) for text usage specifically, leaving the lighter, official
  shade for button backgrounds where it's the correct, sufficiently
  contrasted choice.
- The generated `favicon.ico` failed the production build outright the
  first time — Next.js requires the PNG frames embedded in an `.ico` to
  be RGBA; the initial RGB-mode file decoded fine in ordinary image
  tools but failed Turbopack's stricter decoder. Fixed by regenerating in
  RGBA; re-verified with a full production build afterward, not just by
  re-reading the file.
- Two cropping mistakes caught on review of the delivered files: the
  compact icon+wordmark (light) crop clipped "OASIS" down to "OAS" (a
  transcription error applying an already-correctly-measured boundary),
  and the icon-only crop still included the brand board's own "LOGO MARK
  (SYMBOL)" section header text above the icon. Both re-cropped and
  re-verified edge-clean; every other extracted asset was independently
  re-checked at the same time and confirmed already correct.

### Design decisions of note
- The uploaded Branding Package is a pair of brand *guideline boards*
  (composite reference sheets), not the individual production asset
  files (`.svg`/`.png` cutouts) it names as pending deliverables. Rather
  than guessing crop boundaries by eye or leaving the gap unaddressed,
  the actual pixel data was analyzed programmatically to find the real,
  measured edges of each logo variant, then verified after cropping that
  no edge contains stray content — mechanical extraction of existing
  pixels, not a redesign, recoloring, or reinterpretation of the mark.
- Email templates use literal, confirmed brand values rather than a live
  `AcademySettings` fetch — deliberately, since awaiting a Settings
  lookup inside `auth.service.ts` before building an email would be a
  real control-flow change (a new async dependency, a new failure mode)
  in a module explicitly told not to touch backend logic.
- Every logo placement uses the same `settings?.logoUrl ?? '/brand/...'`
  fallback pattern already established for the favicon in Module 3C —
  an Admin-uploaded custom logo takes priority everywhere automatically;
  the official extracted assets are what a fresh, unconfigured install
  shows.

See `docs/11-module-3d-notes.md` for the complete write-up.

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
