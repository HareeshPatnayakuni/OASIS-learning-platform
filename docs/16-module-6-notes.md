# Module 6 — Implementation Notes
## Student Quiz Attempt Flow

## 1. What was inspected before writing any code

Per the brief's explicit instruction, the following were read in full
before any implementation:

- `Quiz`/`Question`/`QuestionOption`/`QuizAttempt` in `schema.prisma` —
  see §2 for the key finding.
- `docs/03-database-design.md` §2.3 — confirms Quiz has **no status
  field of its own** in V1; visibility is inherited entirely from the
  parent Course's status. This directly shaped how quiz access-checking
  works (§3).
- The existing teacher quiz-authoring module (`modules/quizzes/`) —
  `QuizRepository.findQuizById` already does exactly the query needed to
  fetch a quiz's questions/options; reused directly rather than
  duplicated (see §3).
- `lib/ownership.ts` — `getCourseIdForQuiz` already resolves a quiz's
  parent course, though it doesn't check the course's own status, which
  this module's own access check needed to do explicitly.
- `ContentService`/`ContentRepository` (Module 3A/4A, student content
  access) — the established "resolve parent course → check enrollment
  fresh → then act" pattern, and its own `isStudentEnrolled` method,
  both reused directly rather than reimplemented.
- The Course Player and `CourseSyllabus` — confirmed quizzes were not
  present in the syllabus/navigation at all before this module (§4).

## 2. Key finding: no schema changes needed, and why

`QuizAttempt` has `@@index([quizId, studentId])` but **no unique
constraint** on that pair. Combined with its own schema comment
("Immutable historical record — never soft- or hard-deleted") and the
complete absence of any single-attempt or best-score policy anywhere in
`docs/`, the schema was never built to enforce a single attempt.

**Attempt policy chosen: multiple attempts are allowed.** Each
submission creates a new, independent `QuizAttempt` row; "my attempt"
returns the most recent one (`attemptedAt desc`). This is the simplest
behavior consistent with the schema as it stands — inventing a
single-attempt or best-score policy would have meant adding a unique
constraint or a "keep the best score" comparison the existing design
never called for, which the brief explicitly warned against doing
without inspecting first. **Zero schema changes were made.**

## 3. Design decisions

- **A new, separate student-facing module
  (`modules/quizzes/quiz-attempts.*`), not an extension of the
  teacher-facing `quizzes.*` files** — mirroring the existing
  `courses.repository.ts` (student reads) vs.
  `courses.teacher.repository.ts` (teacher writes) split for the same
  underlying entity. The actual quiz-structure *read* reuses
  `QuizRepository.findQuizById` directly (a real cross-repository
  dependency inside `QuizAttemptService`, the same pattern
  `PaymentService` used with `EnrollmentRepository` in Module 4A) —
  never duplicated.
- **Quiz visibility is checked against the parent Course's status
  directly**, not a quiz-level status field, because there isn't one
  (confirmed in §1). `QuizAttemptRepository.findQuizForAccess` checks
  `quiz.deletedAt`, `module.deletedAt`, `chapter.deletedAt`, and
  `course.status === 'PUBLISHED'`/`course.deletedAt` all in one query,
  returning `null` for any of them — the same 404 either way, so a
  not-yet-published or since-archived course's quiz never leaks its
  existence, matching `ContentService`'s identical treatment of
  DRAFT/HIDDEN lectures.
- **Enrollment is checked via the existing
  `ContentRepository.isStudentEnrolled`**, not a new method — it's
  already the established "can this student access this course's
  content" check, reused by lecture and note access; quizzes are just
  another kind of course content asking the same question.
- **Correct answers are stripped at the service layer, not by a
  different query.** `getQuizForAttempt` calls the exact same
  `findQuizById` the teacher's edit-quiz screen uses (which necessarily
  includes `isCorrect`, since a teacher needs to see and edit it), then
  maps the result to a type that has no `isCorrect` field at all —
  compile-time-enforced, not just "remembered to delete a field."
- **Score is always computed server-side from the real answer key**,
  never from anything the client sends. The request body only ever
  contains `questionId`/`optionId` pairs — there's no `score` field in
  the request schema for a client to send one, let alone have it
  trusted.
- **Every submitted `questionId` is validated against the quiz's actual
  question set, and every `optionId` against its specific question's
  actual option set, before any scoring happens** — rejected with `400`
  (`INVALID_QUESTION_ID`/`INVALID_OPTION_ID`) otherwise. This is the
  literal enforcement of "students cannot submit answers for another
  quiz."
- **A missing answer for a question is scored as incorrect, not
  rejected** — the simplest reasonable behavior for an incomplete
  submission, not a requirement the brief asked for either way. The
  request body does require at least one answer overall (`.min(1)`), so
  an entirely empty submission is still rejected.
- **Per-question correctness is only ever available in a fresh
  submission's own response, never in a later "my attempt" fetch** —
  because `QuizAttempt` only persists `score`/`totalMarks`. This is a
  direct, deliberate consequence of "do NOT add unnecessary schema
  changes solely for detailed answer analytics": showing it transiently
  at submission time costs nothing extra (the real answer key is
  already loaded in memory to compute the score); persisting it would
  need a new table.
- **Frontend: quizzes were added to the Course Player's existing
  sidebar, not a new dashboard.** `CourseSyllabus` (used by both the
  Course Details preview and the Course Player) gained one new rendering
  branch, styled identically to how notes already render there — a
  locked row when not enrolled, a link to
  `/student/courses/{slug}/quiz/{quizId}` when enrolled. Reaching a quiz
  is a click from the same content tree a student already navigates for
  lectures and notes; the player's own video-switching logic
  (`onSelectLecture`, `activeLectureId`) was not touched at all.
- **The quiz page checks for a previous attempt first, before even
  fetching the quiz.** If one exists, its result is shown directly
  (with a "Retake Quiz" button, since multiple attempts are allowed);
  only if none exists does it fetch the quiz and show the form. This
  keeps "Take Quiz" and "view previous result" as one coherent page
  reachable from one link, rather than two separate surfaces.

## 4. Backend

**New files** (`backend/src/modules/quizzes/`): `quiz-attempts.types.ts`,
`quiz-attempts.repository.ts`, `quiz-attempts.service.ts`,
`quiz-attempts.validators.ts`, `quiz-attempts.controller.ts`,
`quiz-attempts.routes.ts`.

**Modified**: `courses.types.ts`/`courses.repository.ts` (added
`QuizSummary`/`quizzes` to the syllabus, inheriting the existing
course-status check the syllabus query already performs — no separate
check needed), `app.ts` (mounted the new router), `src/docs/swagger.ts`
(no new tag needed — reused the existing `Quizzes` tag), one test fixture
(`tests/unit/courses/fakeCourseRepository.ts`, added an empty `quizzes`
array to satisfy the extended type).

**Endpoints** (chosen over the brief's own example paths only in that
`/quizzes/{quizId}/attempt` and `/my-attempt` match the *existing*
`/quizzes/{id}` convention from the teacher module rather than
introducing a different shape):
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/quizzes/:quizId/attempt` | Student | Quiz questions/options, no correct answers |
| POST | `/quizzes/:quizId/attempt` | Student | Submit answers; server-scored result |
| GET | `/quizzes/:quizId/my-attempt` | Student | Most recent attempt, or `null` |

No route collision with the existing teacher `GET /quizzes/:id` — three
path segments vs. two, confirmed live.

## 5. Frontend

**New page**: `student/courses/[slug]/quiz/[quizId]/page.tsx` — Take
Quiz form, Submit, and both result views (fresh submission with
per-question correctness; previous attempt, aggregate only) in one page.

**Modified**: `components/course/CourseSyllabus.tsx` (renders quizzes;
new `courseSlug` prop, needed for the quiz page's link), both of its
call sites (`CourseDetailClient.tsx`, the Course Player), `types/api.ts`
(new types, `QuizSummary` added to `ModuleWithContent`).

## 6. Security checklist

- Only enrolled students can attempt a quiz: `isStudentEnrolled`
  checked on every one of the three endpoints, fresh every time.
- Students cannot submit answers for another quiz: every
  `questionId`/`optionId` validated against the actual quiz's structure
  before scoring; confirmed by two dedicated tests.
- Students cannot manipulate their score: the request schema has no
  score field to send one in; scoring is 100% server-computed from
  `isCorrect`, which never leaves the backend before submission.
- Correct answers are not exposed before submission: enforced by the
  response type itself (`OptionForAttempt` has no `isCorrect` field),
  confirmed by a test asserting the property is absent from every
  option.
- Student identity comes only from the verified JWT: every endpoint uses
  `req.user!.id`, never a client-supplied student ID.
- A student cannot access another student's attempt: `findLatestAttempt`
  is scoped by `studentId` at the query itself, not filtered after a
  broader fetch; confirmed by a test seeding another student's attempt
  and asserting it's invisible.
- Draft/hidden/inaccessible course content is not exposed: `findQuizForAccess`
  checks course status/deletedAt through the full chapter→module→course
  chain, returning the same 404 as a nonexistent quiz.

## 7. Testing

**14 new tests** in `tests/unit/quizzes/quiz-attempts.service.test.ts`,
reusing the existing `createFakeContentRepository` (from
`tests/unit/content/fakeContentRepository.ts`) for enrollment rather
than duplicating a fake. Covers every item in the brief's own testing
list: enrolled access, non-enrolled rejection (403, distinct from the
404 for a genuinely inaccessible quiz), no `isCorrect` before
submission, correct server-side scoring, both invalid-question-ID and
invalid-option-ID rejection, cross-student attempt isolation, and the
chosen attempt policy (multiple attempts, most recent returned, no
question-level detail on a past attempt). 291 backend tests total, all
passing — no frozen-module tests were re-run beyond the normal full
suite (`npm test`), per "do not waste time re-testing every frozen
module."

**Live-verified**: all three endpoints reachable by a Student token
(past routing/auth/validation, to the stub boundary); a Teacher token
gets `403` from the student endpoints; the existing teacher `GET
/quizzes/:id` endpoint still works unaffected (no route collision);
invalid submission bodies `400`; both new paths present with zero parser
errors in the live OpenAPI spec (77 paths, up from 75). The new quiz
page and every other frontend page checked live at `200` with zero
error-boundary indicators.

## 8. Known gaps / genuine limitations

No timers, negative marking, randomization, question banks, or any of
the explicitly out-of-scope items — none built. A past attempt's
per-question breakdown genuinely cannot be shown (not a bug — see §3),
only the aggregate score. No attempt limit — a student can retake a
quiz indefinitely, which is a deliberate consequence of the chosen
attempt policy (§2), not an oversight.
