# Module 3A — Implementation Notes
## Student Learning Experience

Following the same per-module documentation pattern as
`docs/07-module-2-notes.md`. Module 1 and Module 2 remain frozen and
untouched — everything here is additive: new backend modules, new frontend
pages/components, and a handful of small, clearly-flagged corrections to
things Module 1/2 hadn't been exercised against real requirements yet.

---

## 1. What was built

**Backend — 6 new modules**, all following the established Clean
Architecture pattern (`types.ts` interface → `repository.ts` Prisma impl →
`service.ts` business logic → `controller.ts` → `routes.ts` with Swagger
JSDoc):

| Module | Endpoints | Purpose |
|---|---|---|
| `catalog` | `GET /boards`, `/class-grades`, `/subjects` | Filter options for Browse Courses |
| `courses` | `GET /courses`, `GET /courses/:slug` | Browse + course detail with full syllabus |
| `content` | `GET /lectures/:id/stream-url`, `GET /notes/:id/download-url`, `PUT /lectures/:id/progress` | Enrollment-gated signed URLs and progress updates |
| `enrollments` | `GET /enrollments/me` | My Courses / Purchased Courses, with computed progress |
| `streak` | *(no routes — consumed by `content` and `users`)* | Learning Streak counting logic |
| `users` | `GET/PATCH /users/me`, `GET /users/me/streak`, `/continue-watching`, `/announcements` | Profile, streak read, continue-watching, announcements aggregation |
| `search` | `GET /search` | Courses, chapters, modules |

All new routes are documented in Swagger (`/api/v1/docs`) with the same
`@openapi` JSDoc convention as the Auth module.

**Frontend** — auth plumbing (`AuthProvider`/`useAuth`, token storage,
one-shot refresh-on-401), a small design-token system (brand indigo +
accent amber, defined once in `globals.css`), a reusable component library
(`Button`, `Badge`, `ProgressBar`, loading/empty/error states, `CourseCard`,
`CourseFilterBar`, `CourseSyllabus`, `VideoPlayer`, `StreakBadge`,
`AnnouncementList`, `Navbar`), and every page the brief asked for: real
Login/Register/Forgot-Password forms (replacing Module 2's placeholders),
Browse Courses, Course Details, Search Results, Student Dashboard, My
Courses, the Course Player, and Profile.

## 2. Explicitly not built (per your instruction)

Teacher and Admin functionality — no course authoring, no
announcement-creation UI, no payment records. Also not built, because
nothing in Module 3A's feature list asked for them and they depend on
modules that don't exist yet: **Payments** (no API creates a real
`Enrollment` — see §4), **Media** (no image upload — thumbnails/avatars are
`null` until that module exists), **Quizzes**, and the **Notification**
fan-out (Announcements are read-only in this module).

## 3. Design decisions worth explaining

- **Course detail is public with optional personalization**, not
  "enrolled-only" as `docs/04-api-design.md` originally scoped the
  `chapters` endpoint. "Course Details Page" is explicitly listed under
  Module 3A's **Public Website** section — a prospective student needs to
  see the syllabus (chapter/lecture titles, durations) before buying. The
  actually-sensitive part (video bytes, note PDFs) was already a separate,
  strictly enrollment-gated call (`stream-url`/`download-url`) — exposing
  structural metadata (titles/order/duration) alongside that was never a
  real security boundary, so `GET /courses/:slug` now returns the full
  syllabus to everyone, with `isEnrolled` and per-lecture progress added
  only when the requester is a logged-in, enrolled student. This needed a
  new `optionalAuthenticate` middleware (`src/middleware/optionalAuthenticate.ts`)
  — a sibling to `authenticate`, not a replacement; every route that
  genuinely requires a token still uses `authenticate` unchanged.
- **Course progress is computed, not stored.** There's no `progressPercent`
  column anywhere — `EnrollmentService.listMyCourses` counts published
  lectures vs. completed `LectureProgress` rows per course on every read.
  Simpler than keeping a derived value in sync, and at V1's scale (a
  student enrolled in a handful of courses) the extra counts are cheap.
- **Learning Streak uses explicit UTC day boundaries**, not server-local
  time (`streak.service.ts`). Using local time would make the streak's
  day-boundary silently depend on which region a given deployment happens
  to run in. Caught by writing the date-math tests first and noticing the
  behavior wasn't actually pinned to anything — worth calling out because
  it's the kind of bug that only shows up after a redeploy to a different
  region, long after it'd be easy to trace back.
- **Signed URLs use the real AWS S3 SDK** (`@aws-sdk/client-s3` +
  `s3-request-presigner`) against R2's S3-compatible endpoint
  (`src/lib/r2.ts`) — genuine, standard, production-ready code, not a
  placeholder. It returns a clear, typed `R2NotConfiguredError` if
  credentials aren't set rather than a confusing SDK error, matching the
  same "fail clearly" philosophy as `config/env.ts`.
- **No enrollment-creation endpoint exists.** Enrollment happens via a
  successful payment (Payments module, not built) or an Admin action
  (Admin module, not built). Module 3A can't build either, so the demo
  student's enrollment is seeded directly (`database/seed.ts`), the same
  pattern Module 1 already designed for ("Admin-granted scholarship
  enrollment" — `Enrollment.paymentId` is nullable for exactly this
  reason). This isn't a workaround; it's the schema being used as
  designed.

## 4. Real bugs found and fixed while building this

Consistent with Module 2's pattern of actually running things rather than
assuming they work:

1. **`database/seed.ts` couldn't resolve `@prisma/client` at all.**
   `database/` is a sibling of `backend/`, not a descendant — Node's module
   resolution walks up a file's own ancestors, never sideways, so
   `npm run seed` failed with `MODULE_NOT_FOUND` the very first time it was
   actually run (it was written in Module 2 but never executed end-to-end
   until now). Fixed with `NODE_PATH=./node_modules` in the `seed` script,
   pointed at backend's own `node_modules`. This also seeds two real demo
   accounts (`student@oasis.example.com` / `teacher@oasis.example.com`,
   both `bcrypt`-hashed with the same cost factor as the real Auth module)
   plus two published courses with a full syllabus, one demo enrollment
   with partial progress already recorded, and a starter streak — enough
   for the frontend to have something real to render.
2. **`next.config.ts`'s `output: "standalone"`** (added in Module 2 for the
   optional self-hosted Docker path) **turned out to be incompatible with
   plain `next start`** — the command a developer runs locally to sanity-check
   a production build. Verified live: `next start` printed a warning and
   never actually served a request. Fixed by gating `output: "standalone"`
   behind a `DOCKER_BUILD` env var that only `docker/frontend.Dockerfile`
   sets; everyone else's build (local `npm start`, Vercel) is unaffected.
3. **Two `react-hooks/set-state-in-effect` violations** (`CourseFilterBar`'s
   search input, the Course Player's signed-URL fetch) — both were calling
   `setState` synchronously at the top of an effect to reset state before
   an async operation, which the current React ESLint rules flag as an
   anti-pattern (cascading renders). Fixed by restructuring: the search
   input is now an uncontrolled field keyed on the URL's `q` param instead
   of state kept in sync via an effect; the signed-URL fetch tags its
   result with the lecture ID it was fetched for and derives staleness at
   render time instead of eagerly clearing state.

## 5. Testing

**Backend: 117 unit tests across 13 suites** (77 from Module 2 + 40 new),
all against the same mocked-repository pattern established in Module 2 —
no database required. New coverage: `CourseService` (filtering, pagination,
the public-vs-enrolled merge logic), `ContentService` (enrollment gating on
every method, DRAFT-lecture 404-not-403 behavior, streak integration),
`EnrollmentService` (progress percentage math, including the
division-by-zero-safe 0-lecture case), `UserService` (catalog-reference
validation on profile updates), `SearchService`, and `StreakService`
(the date-math rules, including an explicit UTC midnight-crossing case).

**Frontend:** no unit tests were added — Module 3A's "write unit tests
where appropriate" was interpreted as backend business logic (where the
established, working mocked-repository pattern applies directly) rather
than frontend components, which have comparatively little standalone logic
worth isolating (most of what they do is call `authFetch` and render — the
interesting behavior lives in `AuthProvider`, which would need a fuller
React Testing Library setup not yet present in this project). Flagging this
as a gap rather than silently skipping it: if component/hook tests are
wanted, `AuthProvider`'s refresh-on-401 logic is the highest-value target.

**Live validation** (same rigor as Module 2, same sandbox limitation — see
`docs/07-module-2-notes.md §6` for why `prisma generate` can't run here):
booted backend + frontend together against the real local Postgres
instance. Confirmed live: `authenticate` + `requireRole('STUDENT')`
correctly gate every student-only route (a valid STUDENT token reaches the
repository call; a valid TEACHER token gets a clean 403); Zod validation
rejects malformed input before touching the database; the frontend's public
pages render correctly and every data-fetching page fails gracefully
(visible error states, not crashes) against the stub's simulated backend
failure; `npm start` serves real HTML end-to-end post-fix.

## 6. Known gaps / deferred (flagged, not silently dropped)

- **No frontend component/hook tests** — see §5.
- **Dark mode not chased for new components.** The base app supports
  `prefers-color-scheme` (Module 2), but none of Module 3A's new components
  add `dark:` variants — every one of them was built mobile-responsive
  (the actual explicit requirement) but light-mode-only. Revisit if dark
  mode turns out to matter to real users.
- **Video captions/transcripts** aren't addressed — there's no pipeline
  producing them yet (that's a Teacher-module + content-processing concern,
  well outside Module 3A).
- **No automatic background token refresh** — `AuthProvider` refreshes
  once, reactively, on a 401. A session that's open but idle for longer
  than the access token's lifetime will refresh on the next API call
  rather than proactively in the background. Reasonable for V1; a
  scheduled silent-refresh timer is a small, isolated addition later if
  needed.

## 7. Pre-freeze verification pass

Before freezing Module 3A, you asked for 5 specific correctness/security
items to be verified against the actual code and a live-generated OpenAPI
spec — not assumed. Here's what that check found:

| # | Item | Result |
|---|---|---|
| 1 | Course progress can never exceed 100% | ⚠️ **Hardened.** By construction it already couldn't: `completedLectures` and `totalLectures` are counted with matching filters, and a lecture can only be marked complete while `PUBLISHED` (`ContentService.updateLectureProgress`). Added an explicit `Math.min(100, Math.max(0, ...))` clamp in `enrollments.service.ts` anyway — a publicly-displayed percentage should be structurally incapable of exceeding 100%, not merely correct today because two independent queries happen to agree. Tested with a deliberately inconsistent repository response (7 completed / 3 total → clamped to 100). |
| 2 | Streak can't be inflated by repeated calls in one day | ✅ **Already correct** — `streak.service.ts`'s `recordActivity` returns the existing snapshot unchanged when `dayDiff === 0` (same calendar day as `lastActiveDate`). Since `ContentService.updateLectureProgress` calls this on every progress save (as often as every 10 seconds during playback per `VideoPlayer`'s throttle), this path is exercised constantly — verified safe even under concurrent calls (both would read the same prior state and compute the identical new value, not compound it). Tested explicitly (`streak.service.test.ts`, "does not change the streak for a second activity on the same calendar day"). |
| 3 | Students can't access draft/hidden lectures via a known URL | ⚠️ **Fixed — a real gap, not just a hypothetical.** The *streaming* endpoint (`GET /lectures/:id/stream-url`) already correctly 404'd a non-`PUBLISHED` lecture regardless of enrollment (tested). But `courses.repository.ts`'s syllabus query — which backs the **public** `GET /courses/:slug` — filtered lectures only by `deletedAt: null`, not by status, so a DRAFT or HIDDEN lecture's title/duration was still visible to anyone browsing the course, even anonymously. Streaming was blocked; the lecture's existence and title weren't. Fixed by adding `status: 'PUBLISHED'` to that query's `where` clause. |
| 4 | Signed R2 URLs are short-lived and non-reusable | ⚠️ **Corrected a real usability bug found while verifying.** Expiry itself was always genuinely enforced (R2 rejects an expired presigned URL via signature verification — not merely "not offered again"). But the single shared TTL was 10 minutes for *both* lecture streaming and note downloads — fine for a one-shot PDF download, but seed data already has a 900-second (15-minute) lecture, and real coaching lectures commonly run 30–60+ minutes; video playback would have silently broken partway through any lecture longer than ~10 minutes as the browser's later Range requests hit an expired signature. Split into two TTLs: 4 hours for lecture streaming (`lib/r2.ts`), 10 minutes retained for note downloads. Tested (`r2.test.ts`), including a test that the lecture TTL exceeds a realistic 60-minute class. |
| 5 | Every Module 3A API is in Swagger | ✅ **Verified empirically, not by memory** — booted the server, fetched the real generated `/api/v1/docs.json`, and enumerated every path. All 15 new Module 3A endpoints are present (3 catalog + 2 courses + 3 content + 1 enrollments + 5 users + 1 search), alongside all 9 unchanged Auth endpoints from Module 2. 23 total, matching exactly. |

Two of these (3 and 4) were genuine gaps, not just verification busywork —
worth being direct about that rather than reflexively saying everything
was already fine. Test count: 123 (was 117), all passing; `tsc`/lint clean
on both packages.

---

## Module 3A: FROZEN

Per your instruction, Module 3A — Browse/search/filter courses, Course
Details with full syllabus, enrollment-gated signed video/note URLs, the
Course Player (navigation, resumable playback, progress, mark-complete),
Learning Streak, Continue Watching, Announcements, and Profile — is now
permanent, alongside Modules 1 and 2. Future modules build on the patterns
established here (`optionalAuthenticate` for personalize-but-don't-require
routes, computed-not-stored progress, the two-tier signed-URL TTL) rather
than redesigning them. Module 3B is next.

## 8. Quick reference

```bash
# Backend
cd backend && npm run dev          # http://localhost:4000

# Frontend (separate terminal)
cd frontend && npm run dev         # http://localhost:3000

# Seed demo data (after `npx prisma migrate dev`)
cd backend && npm run seed
#   Student: student@oasis.example.com / Student@123
#   Teacher: teacher@oasis.example.com / Teacher@123 (no teacher UI yet — provisioned for later modules)

npm test        # backend: 123 tests
npm run lint    # both packages
npm run build   # both packages
```
