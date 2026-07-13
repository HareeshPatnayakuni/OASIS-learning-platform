# Module 3C — Implementation Notes
## Admin Dashboard & Platform Management

Continues the per-module documentation pattern from `docs/07`–`docs/09`.
Modules 1, 2, 3A, and 3B remain frozen. This module is deliberately an
MVP, per your explicit instruction — every list below is a simple
paginated table, every stat a plain count, no charts/reports/audit logs.

---

## 1. What was built

**Backend — one new `admin` module**, organized the same way
`content-management` was in Module 3B (one repository interface, one
Prisma implementation, several focused service files, one controller
composing them, one routes file):

| Area | Endpoints | Notes |
|---|---|---|
| Dashboard / Analytics | `GET /admin/dashboard`, `GET /admin/analytics` | Counts + recent registrations/announcements; analytics adds activeUsers/publishedCourses |
| Teachers | `GET/POST /admin/teachers`, `PATCH /admin/teachers/:id`, `PATCH .../status`, `POST .../reset-password` | Add/edit/disable-enable/reset-password |
| Students | `GET /admin/students`, `PATCH .../status`, `POST .../reset-password` | No edit endpoint — the brief didn't ask for one, only Teachers get edit |
| Courses | `GET /admin/courses`, `PATCH .../archive`, `DELETE /admin/courses/:id` | Read-only oversight + archive/delete only — no chapter/module/lecture/quiz/note access at all |
| Announcements | `GET/POST /admin/announcements`, `PATCH/DELETE .../:id`, `GET /announcements/platform` | Platform-wide (courseId always null); last one is the sole public, non-admin route in this module |
| Settings | `GET/PATCH /admin/settings`, `GET /settings` (public, added during pre-freeze verification — see §7) | Academy name/full name/tagline/contact/address/social links/logo/favicon |

**Frontend:** Admin Dashboard home, Teachers (list/search/add/edit/
disable/reset), Students (list/search/disable/reset), Course Oversight
(list/search/filter by status/archive/delete-with-confirm), Platform
Announcements (create/edit/delete), Platform Settings (with logo/favicon
upload) — all behind a new `admin/layout.tsx` guard with a simple
sub-navigation, mirroring the `student/`/`teacher/` layout pattern
exactly.

## 2. Explicitly not built (per your instruction)

Parent Dashboard, attendance, assignment management, certificates, audit/
activity logs, CSV export, email campaigns, a notification center, chat,
discussion forum, AI features, scheduling, calendar, live classes, Zoom/
Meet integration, a CMS, advanced analytics, graphs, reports. Admin also
cannot edit chapters, modules, lectures, quizzes, or notes — structurally,
not just by convention (see §3).

## 3. Design decisions worth explaining

- **`AdminCourseService` has no dependency on `content-management`'s
  repository at all.** "Admin must NOT edit chapters/modules/lectures/
  quizzes/notes" is enforced by the service literally not having a method
  that could reach that content — there's no method to accidentally call,
  not just a permission check that could be bypassed. A dedicated test
  (`courses.service.test.ts`, "structural guarantee") asserts this
  directly by inspecting the service's own method list.
- **Password reset reuses Module 2's real `AuthService.forgotPassword`
  flow** rather than a new "set password directly" mechanism. Admin
  triggers the exact same tested, secure flow a user's own "forgot
  password" would (generates a hashed reset token, emails a link) — a
  plaintext password never transits the Admin API or its response body,
  even as a temporary value. `AuthService`/`PrismaAuthRepository` are
  imported and composed exactly as Module 2 exports them; nothing there
  was modified.
- **Both `ADMIN` and `SUPER_ADMIN` are accepted** on every route in this
  module, even though your brief says "Only ADMIN users." `SUPER_ADMIN`
  already existed in the frozen `UserRole` enum with no defined semantics
  anywhere in the docs; the reasonable default is that a more-privileged
  role has at least the access a less-privileged one does, not less.
  Trivial to narrow to `requireRole('ADMIN')` alone later if that's not
  wanted.
- **"Active Users" is defined as distinct users holding at least one
  currently-valid (non-revoked, unexpired) refresh token** — i.e. logged
  in on at least one device right now. No `lastLoginAt` field exists on
  `User`, and adding one wasn't warranted for a single analytics number;
  this reuses the existing `RefreshToken` table Module 2 already built,
  with zero schema changes.
- **Platform-wide announcements are Announcement rows with `courseId:
  null`** — the schema already supported this nullable FK before this
  module (`docs/03-database-design.md`), it simply had no writer. `GET
  /announcements/platform` is the one deliberately-public route in this
  file (no auth at all), because "these announcements appear to every
  user" includes logged-out visitors — it's mounted at `/api/v1` root
  rather than under `/admin/...` for exactly that reason.
- **A new `PlatformAnnouncementsBanner` component is mounted once, in the
  root layout, below the Navbar** — rather than duplicating a fetch on
  every dashboard (student/teacher/admin) or skipping display entirely.
  This is the one place this module touches a Module 3A frozen file
  (`app/layout.tsx`, one import + one line), justified because it's the
  only way "appears to every user" (including anonymous visitors) can be
  literally true without duplicating the same fetch three or more times
  across frozen dashboard pages. Dismissal is per-browser and
  per-announcement (localStorage, keyed by announcement ID), so a new
  announcement always reappears even if an older one was dismissed.
- **Two small, additive schema fields** on `AcademySettings`:
  `academyFullName` and `faviconId` (paired with a new `favicon` relation
  to `Media`). The brief asked for both explicitly and neither existed.
  Adding a second relation to the same related model (`Media`) required
  giving both the existing `logo` relation and the new `favicon` relation
  explicit `@relation` names — Prisma requires this once a model has 2+
  relations to the same related model, so `logo`'s relation went from
  unnamed to `"SettingsLogo"` as the minimal necessary consequence of
  the addition, not a behavior change (the field, its type, and what it
  points to are all unchanged).
- **`POST /media` and `DELETE /media/:id` (Module 3B) now also accept
  `ADMIN`**, alongside the existing `TEACHER` — needed for logo/favicon
  upload, and already anticipated by Module 3B's own `MediaPurposeValue`
  including an `ACADEMY_LOGO` case with a note in `PROJECT_MEMORY.md`
  that nothing could use it yet. A two-word, backward-compatible widening
  of an existing `requireRole(...)` call, not a redesign.
- **No Admin registration flow.** Module 3C doesn't ask for one, and the
  brief only asks Admin to *manage* teachers/students. A demo Admin
  account is seeded directly (`database/seed.ts`), the same pattern
  already used for the demo teacher/student accounts.

## 4. Real bugs found and fixed while building this

None found in this module's own new code this time — the Swagger YAML
mistake from Module 3B (docs/09 §4) was specifically checked against
before considering this module done, and this time the check passed
clean on the first live boot (65 path entries, zero parser errors). Worth
recording as a negative result rather than silence: the live-boot-and-read-
stdout step is now a standing part of finishing any module that adds
routes, not a one-off reaction to the previous mistake.

## 5. Testing

**Backend: 238 unit tests across 28 suites** (203 carried over from
Module 3B + 35 new), same mocked-repository pattern throughout. New
coverage: `AdminDashboardService` (aggregation correctness, zero-data
edge case), `AdminTeacherService` (creation, duplicate-email rejection,
edit, disable/enable, and — critically — that `resetPassword` calls the
real `AuthService.forgotPassword` with the teacher's email and nothing
else, never a plaintext password), `AdminStudentService` (search,
disable/enable, password reset reuse), `AdminCourseService` (status
filtering, archive, delete, and the structural
cannot-touch-content guarantee described in §3), `AdminAnnouncementService`
(courseId always null, CRUD), `AdminSettingsService` (partial updates,
clearing a field back to null).

**Live validation:** booted backend + frontend together against the real
local Postgres instance (same sandbox limitation as every prior module).
Confirmed live, with real JWTs for all four roles: STUDENT and TEACHER
tokens get a clean 403 on `/admin/dashboard`; ADMIN and SUPER_ADMIN tokens
both reach the database stub boundary (RBAC passed); no token gets 401;
`GET /announcements/platform` with no token reaches the stub boundary
directly rather than 401, confirming it's genuinely public; a TEACHER
token attempting `DELETE /admin/courses/:id` gets 403; an ADMIN token on
`POST /media` reaches past the RBAC layer to the (expected, in this
sandbox) "R2 not configured" error, confirming the role-widening works.
Every new admin frontend page renders its auth-guard shell correctly
(200) against the live stack.

## 6. Known gaps / deferred

- **No frontend component/hook tests**, consistent with Modules 3A/3B's
  documented gap and the same reasoning.
- **No pagination controls in the Teacher/Student/Course/Announcement
  admin UI tables** — the backend supports `page`/`limit` fully (tested),
  but the frontend currently just requests a generous single page (up to
  `limit=50`) rather than rendering page-forward/back controls. Fine at
  V1's expected scale (a single coaching institute's teacher/student
  counts); worth adding real pagination UI once a deployment's user count
  makes a single page unwieldy.
- **Settings social links only expose Instagram/YouTube/Facebook fields**
  in the UI, even though the backend's `socialLinks` is a free-form
  `Record<string, string>` that accepts any key. A reasonable default set
  covering the platforms most coaching institutes actually use; adding
  another platform's field to the form is a small, contained frontend
  change whenever wanted.

## 7. Pre-freeze verification pass

Before freezing, you asked for 5 specific items to be verified against
the actual code (and live requests) — not assumed. Four were already
correctly implemented; one was a genuine, real gap that's now fixed.

| # | Item | Result |
|---|---|---|
| 1 | Only ADMIN/SUPER_ADMIN can access any Admin API or page | ✅ **Already correct, re-verified exhaustively.** Counted every route definition in `admin.routes.ts` (20 total) against every use of the `adminOnly` middleware chain (19) — the one gap is exactly the one deliberate exception, `GET /announcements/platform`. `admin/layout.tsx` mirrors this with `user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN'`. |
| 2 | Teachers/Students cannot access Admin routes by changing URLs | ✅ **Already correct — verified live, not just by reading the code.** A STUDENT token was sent against all 7 read endpoints (`dashboard`, `analytics`, `teachers`, `students`, `courses`, `announcements`, `settings`) — every one returned a clean 403. A TEACHER token was sent against 4 write endpoints (`archive`, `delete`, `status`, `POST announcements`) — same result. Also tried two naive bypass attempts (a trailing slash, and `/Admin/Dashboard` with different casing) — both still hit the RBAC middleware and got 403, since Express doesn't treat either as a different registered route. |
| 3 | Platform Settings load dynamically everywhere — nothing important hardcoded | ⚠️ **Found a real gap and fixed it.** `AcademySettings`'s own schema comment (written in Module 1) explicitly anticipated "a public GET endpoint for the frontend footer/contact page" — Module 3C's first pass built the Admin *write* side (`GET/PATCH /admin/settings`, both auth-required) but never actually exposed that public *read* side. Concretely, this meant the Navbar brand text, the page `<title>`, and the (placeholder) Home page hero were all still hardcoded `"OASIS"`/`"Online Academy for Smart Integrated Studies"` literals with nowhere to read Admin's actual configured values from. Fixed by adding `GET /settings` (public, reuses the exact same `AdminSettingsService.getSettings()` — no new business logic, no filtering needed since `PlatformSettings` only ever holds public-facing fields already), and wiring three consumers to it: `Navbar.tsx` (new `usePlatformSettings()` hook), the root `layout.tsx`'s metadata (now `generateMetadata()` instead of a static `export const metadata`, also driving the favicon dynamically when one's uploaded), and the placeholder Home page (server-side fetch, matching the pattern Browse Courses already uses). All three fall back to the pre-existing static strings only if the fetch fails — a resilience fallback, not a reintroduction of hardcoding as the source of truth. Also caught, while fixing this, that Next.js's default fetch caching would have baked these values in at *build time* with no refresh — added an optional, purely-additive `revalidate` passthrough to `lib/api-client.ts`'s `RequestOptions` (existing callers unaffected, since it's undefined unless explicitly passed) and set a 60-second window on these three calls, confirmed in the build output (`Revalidate: 1m` on every static route). Login/register page copy ("Welcome back to OASIS") was deliberately left alone — marketing copy, not one of the branding/contact fields you listed. |
| 4 | Admin can archive/delete courses but never touch academic content | ✅ **Already correct, re-confirmed.** Re-ran the structural-guarantee test (`AdminCourseService` has no method whose name matches chapter/module/lecture/quiz/note) and grepped `admin.routes.ts` directly for the same terms — zero matches, confirming no route was added that could reach content. |
| 5 | All Module 3C APIs are in Swagger | ✅ **Already correct, re-verified including the new endpoint.** Regenerated the live spec after adding `GET /settings` — it's present, and correctly shows no `security` requirement (i.e., documented as genuinely public), matching every other endpoint's actual behavior. |

Item 3 was the one genuine finding — worth being direct that it was a real gap in the initial Module 3C pass, not a false alarm, since three separate hardcoded strings across the frontend were actually replaced with values read from the database as a result.

---

## Module 3C: FROZEN

Per your instruction, Module 3C — Admin Dashboard, Analytics, Teacher and
Student management, read-only Course Oversight (archive/delete only),
platform-wide Announcements, and Platform Settings (now genuinely
database-driven everywhere it's displayed) — is now permanent, alongside
Modules 1, 2, 3A, and 3B. The new public `GET /settings` pattern (same
service/data as an existing admin-only endpoint, exposed a second time
without auth for public-facing display) is the one worth remembering for
future modules: when a frozen module's own schema comment describes an
intended public read path that was never built, that's a real gap worth
closing, not a hypothetical.

## 8. Quick reference

```bash
# Backend
cd backend && npm run dev          # http://localhost:4000

# Frontend (separate terminal)
cd frontend && npm run dev         # http://localhost:3000

# Demo admin login (after seeding)
#   admin@oasis.example.com / Admin@123

npm test        # backend: 238 tests
npm run lint    # both packages
npm run build   # both packages
```
