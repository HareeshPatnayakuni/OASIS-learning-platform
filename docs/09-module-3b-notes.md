# Module 3B — Implementation Notes
## Teacher Dashboard & Course Management

Continues the per-module documentation pattern from `docs/07` and `docs/08`.
Modules 1, 2, and 3A remain frozen. Everything here is additive: 5 new
backend modules, teacher-facing extensions to the existing `courses`
module (new files, not edits to Module 3A's), and every frontend page the
brief asked for.

---

## 1. What was built

**Backend — 5 new modules, plus teacher-write extensions to `courses`:**

| Module | Endpoints | Purpose |
|---|---|---|
| `media` | `POST /media`, `DELETE /media/:id` | Signed image-upload URLs (course thumbnails) |
| `courses` (teacher extension) | `POST /courses`, `PATCH /courses/:id`, `PATCH /courses/:id/status`, `GET /courses/mine`, `GET /courses/mine/:id` | Create/edit/Draft-Publish-Archive courses; list/fetch your own |
| `content-management` | 19 endpoints across chapters/modules/lectures/notes | Create/edit/delete/reorder content; video & PDF upload URLs; `GET /courses/:id/content` (Course Builder read model) |
| `quizzes` | `GET/POST /modules/:id/quizzes`-family, `GET/PATCH/DELETE /quizzes/:id` | Create/edit/delete quizzes with questions and options |
| `announcements` (teacher write side) | `POST /courses/:courseId/announcements`, `PATCH/DELETE /announcements/:id`, `GET /announcements/mine` | Post/edit/delete announcements, with student notification fan-out |

**Frontend:** Teacher Dashboard home (basic stats, recent announcements,
quick links), My Courses (table view, every status), Create Course,
Edit Course (fields, thumbnail upload, Draft/Publish/Archive controls),
Course Builder (chapters → modules → {lectures, notes, quizzes}, all with
create/edit/delete, move-up/move-down reordering, video/PDF upload, lecture
status control, and an inline quiz builder), and Announcements management
(create scoped to a course, edit, delete).

## 2. Explicitly not built (per your instruction)

Assignments, attendance, certificates, AI features, analytics (beyond the
basic counts the Dashboard asked for), and scheduling. No Zoom/Meet
integration — teachers paste a meeting link into an announcement's body,
exactly as you described. No student-facing "take this quiz" flow (quizzes
can be authored; attempting them is a future module — `QuizAttempt`
already exists in the schema for when that's built).

## 3. Design decisions worth explaining

- **Reordering is numeric move-up/move-down, not drag-and-drop or an
  arbitrary-position API** — per your explicit instruction. Every
  reorderable resource (chapters within a course, modules within a
  chapter, lectures within a module) exposes one `PATCH .../move` endpoint
  taking `{ direction: 'up' | 'down' }`, which swaps the item's `order`
  with its immediate sibling (`reorder.util.ts`'s `moveSibling`, shared
  across all three resource types). Notes weren't given a reorder endpoint
  — your feature list only asked for it on Chapters/Modules/Lectures.
- **Uploads are signed-PUT, not proxied through Express** — matching
  "Continue using signed Cloudflare R2 uploads" literally. The backend
  never receives the video/PDF/image bytes: it generates a
  collision-resistant object key, signs a short-lived PUT URL for it, and
  the browser uploads directly to R2. Two *separate* signing paths, not
  one shared function: `lib/r2.ts` (private bucket — lecture videos,
  notes) gained new PUT-signing exports additively (its existing GET
  exports from Module 3A are untouched); `lib/r2Public.ts` is an entirely
  new file for the public bucket (course thumbnails), with its own
  credentials and its own client, per Module 1's original media strategy
  of never letting the two buckets' pipelines touch.
- **Teacher-facing content management is a separate module
  (`content-management`) from Module 3A's frozen `content` module**, not
  an extension of it. `content` only ever handles student-facing signed
  URLs and progress; this one handles teacher writes. They share the
  Prisma schema, never each other's code — this was the cleanest way to
  honor "don't touch Module 3A" literally while still building on the
  same schema.
- **Course quiz editing is "replace the whole question set," not
  per-question PATCH.** Module 1's schema already treats Question/
  QuestionOption as pure structural children with cascade-delete; matching
  a teacher's actual workflow (edit a quiz via one form submission)
  against a diffing API for individual question updates wasn't worth the
  complexity Module 3B didn't ask for.
- **Announcement creation fans out a Notification per enrolled student**,
  exactly as Module 1 originally designed
  (`docs/02-architecture.md §6.1`) — Module 3A explicitly deferred this
  since nothing could create an Announcement yet. Now something can, so
  the already-designed trigger is wired up as part of it, not a new
  feature invented for Module 3B.
- **A new teacher-scoped `GET /courses/mine/:id`**, distinct from Module
  3A's public `GET /courses/{slug}`. That route only ever returns
  PUBLISHED courses looked up by slug — structurally incapable of serving
  a DRAFT course back to its own teacher for editing. Adding an ID-based,
  any-status, ownership-checked sibling was the only way to support the
  Edit Course page without touching the frozen route at all.
- **A new `GET /courses/{id}/content`** (Course Builder read model) —
  every lecture status (not just PUBLISHED), plus notes and quiz
  summaries. This is the single biggest reason the frontend needed a
  backend addition mid-module: writing 19 granular mutation endpoints
  doesn't help the Course Builder page render anything without one
  endpoint that returns the whole current tree to edit against.

## 4. Real bugs found and fixed while building this

1. **A genuine YAML syntax error in a Swagger JSDoc comment broke the
   entire OpenAPI spec for one route file.** The `GET /courses/{id}/content`
   doc's description contained literal curly braces
   (`{lectures, notes, quizzes}`), which `swagger-jsdoc`'s YAML parser read
   as a nested flow-map and failed to parse. Caught by actually booting the
   server and reading its stdout during live testing — the failure showed
   up as a startup-time YAML parser error, not a TypeScript or lint error,
   which is exactly why "does it build" isn't sufficient verification for
   anything Swagger-related; the server has to actually run once. Fixed by
   rephrasing the description to avoid literal braces. Re-verified after
   the fix by regenerating the spec and confirming the specific endpoint
   is present with the correct description — 49 path entries total, up
   from the 47 counted before this fix (some entries in that file were
   likely silently dropped by the parse failure).
2. **Missing single-course read endpoints were discovered while building
   the frontend, not before.** Two gaps surfaced only once the Edit Course
   and Course Builder pages actually needed data no endpoint provided yet:
   a teacher-scoped single-course fetch (`GET /courses/mine/:id`) and the
   full-tree Course Builder read model (`GET /courses/{id}/content`,
   `GET /quizzes/{id}`). Both added as new, additive endpoints — see §3.
3. **A stray leftover `.env` file from live-testing silently reintroduced
   2 test failures on a later run.** `config/env.ts` imports `dotenv/config`,
   which fills in any `process.env` variable that's currently *unset* from
   a `.env` file on disk — exactly the state `env.test.ts`'s "exits when a
   required secret is missing" cases deliberately create by deleting that
   variable. A `.env` file left over from an earlier manual server-boot
   session (not deleted before the next full test run) meant those two
   tests silently found their "missing" variable anyway. Not an
   application bug — a testing-hygiene one, worth naming so it's not
   mistaken for one later: **any manual `.env` created for live testing
   must be deleted before the test suite runs again**, or `env.test.ts`'s
   deliberately-broken-env cases become unreliable.

## 5. Testing

**Backend: 203 unit tests across 22 suites** (117 carried over from Module
3A + 86 new), same mocked-repository pattern throughout. New coverage:
`MediaService` (content-type validation, ownership on delete, graceful
R2-delete-failure handling), `TeacherCourseService` (slug generation and
collision handling, ownership on every write, free status transitions,
the new single-course fetch), all 4 content-management services
(`ChaptersService`/`ContentModulesService`/`LecturesService`/`NotesService`
— ownership chains, move-up/down including boundary rejection, upload URL
issuance, status transitions), `QuizzesService` (question/option
validation rules, wholesale replace-on-edit, ownership), and
`TeacherAnnouncementService` (ownership, the notification fan-out,
zero-enrolled-students edge case).

**Live validation:** booted backend + frontend together against the real
local Postgres instance (same sandbox limitation as every prior module —
`prisma generate` can't reach `binaries.prisma.sh` here). Confirmed live:
a valid TEACHER token reaches every new endpoint's business logic (correct
500 at the stub boundary, not a routing/auth failure); a STUDENT token
attempting `POST /courses` gets a clean 403 before any service code runs;
malformed request bodies are rejected by Zod before touching the database;
an intentionally-invalid quiz (no correct option) is rejected by the
service-layer business rule, live, not just in a unit test; the frontend's
new Teacher pages render correctly and fail gracefully against the stub's
simulated backend errors.

## 6. Known gaps / deferred

- **No frontend component/hook tests**, consistent with Module 3A's
  documented gap and the same reasoning (`docs/08-module-3a-notes.md §5`).
- **Upload content-type/size enforcement is client-declared, not
  server-verified at the byte level.** A presigned PUT URL doesn't let the
  backend inspect the actual bytes before they land in R2 — `contentType`
  is validated as a value the client *says* it's sending, matching the
  `Content-Type` header the signature is bound to, but nothing stops a
  browser from lying about what it uploads. Real enforcement would need
  presigned POST with policy conditions (size limits, stricter content-type
  binding) instead of a plain presigned PUT — a reasonable hardening step
  later, not built now given the added complexity.
- **The Course Builder refetches the entire content tree after every
  mutation** rather than updating local state surgically. Simple and
  correct; fine at the scale of a single coaching course's chapter list,
  worth revisiting only if a real course turns out to have enough content
  for this to feel slow.

## 7. Pre-freeze verification pass

Before freezing, you asked for 3 specific security/correctness items to
be verified against the actual code (and live requests where the sandbox
allows) — not assumed. All three were already correctly implemented; no
code changes were needed.

| # | Item | Result |
|---|---|---|
| 1 | Teachers can only modify their own courses/content — not by changing IDs | ✅ **Already correct, verified thoroughly.** Every mutating method across all 4 content-management services (`ChaptersService`, `ContentModulesService`, `LecturesService`, `NotesService`), `TeacherCourseService`, `QuizzesService`, and `TeacherAnnouncementService` calls an ownership-assertion helper *before* doing anything else — confirmed by direct inspection of every public method, not sampling. Critically: every controller derives the acting teacher's identity from `req.user!.id` (the verified JWT claim) — grepped every one of the 6 relevant controllers and confirmed **zero** instances of a teacher/author ID being read from `req.body` or `req.params`, which is the actual IDOR risk this item is about (a client can't claim to be a different teacher no matter what IDs it passes). The underlying `lib/ownership.ts` queries (`isCourseOwnedByTeacher` and the `getCourseIdForX` traversal helpers) filter by both the resource ID *and* the teacher ID together, so a mismatched owner resolves to "not found/not yours," never a leak. Backed by 203 passing unit tests that explicitly mock the cross-teacher rejection path, plus a live check: a STUDENT-role token hitting `PATCH /chapters/{id}`, `POST /modules/{id}/quizzes`, and `POST /lectures/{id}/reupload-url` all get a clean 403 at the RBAC layer, before any ownership logic even runs. |
| 2 | Upload endpoints verify ownership before generating signed upload URLs | ✅ **Already correct, verified by exact line order, not just presence.** In both `LecturesService.createLecture`/`getReuploadUrl` and `NotesService.createNote`/`getReuploadUrl`, the ownership-assertion call is on the line *before* the call to `getLectureUploadUrl`/`getNoteUploadUrl` — confirmed by reading the literal source, not inferring it from test mocks. `POST /media` (course thumbnails) doesn't need an equivalent check: it creates a brand-new row scoped to `uploadedById: req.user!.id`, with no pre-existing resource to own — the IDOR-relevant check there is that a teacher can't attach someone *else's* upload to their own course, which is enforced on the other side of that operation (`PATCH /courses/{id}` requires course ownership for any field, including `thumbnailId`). |
| 3 | Only Published courses are visible publicly to students | ✅ **Already correct — this is Module 3A's frozen guarantee, unaffected by Module 3B.** Re-verified rather than assumed: `courses.repository.ts`'s `listPublishedCourses` and `findPublishedCourseBySlugWithContent`, and all three levels of `search.repository.ts`'s queries (courses, chapters, modules), filter `status: 'PUBLISHED'` at the Prisma query itself. Module 3B never touched these files. Live-checked that `GET /courses` still requires no auth token and reaches the same stub boundary as before, confirming the public route wasn't accidentally changed. |

No corrections were needed for any of the three items — worth stating
plainly rather than manufacturing a change to seem thorough.

---

## Module 3B: FROZEN

Per your instruction, Module 3B — Teacher Dashboard (stats, recent
announcements), Course Management (create/edit/Draft-Publish-Archive,
thumbnail upload), Content Management (chapters/modules/lectures/notes
with move-up/down reordering, signed video/PDF uploads, lecture status),
Quizzes (author/edit/delete), and Announcements (with notification
fan-out) — is now permanent, alongside Modules 1, 2, and 3A. Future
modules build on the patterns established here (ownership-assertion
before every write, the two-file signed-URL pattern for uploads vs
downloads, numeric move-up/down reordering, `content-management` as a
sibling to `content` rather than a shared module) rather than redesigning
them.

## 8. Quick reference

```bash
# Backend
cd backend && npm run dev          # http://localhost:4000

# Frontend (separate terminal)
cd frontend && npm run dev         # http://localhost:3000

npm test        # backend: 203 tests
npm run lint    # both packages
npm run build   # both packages
```
