# Module 4B — Implementation Notes
## Payment Management

## 1. Scope and what was reused vs. added

Read-only visibility into payments — no new payment logic. Module 4A's
purchase/verify flow, transaction, and idempotency guarantees are
completely untouched; this module only adds new *read* queries against
the same `Payment` table, plus three new pages.

**No schema changes at all** — `Payment` already had every field this
module needed. No new tables.

## 2. Field decisions — what's shown, what's honestly omitted

The brief listed "Payment Method (if stored)" and "Transaction ID (if
applicable)" for the My Payments list — both explicitly hedged with
"if stored"/"if applicable." Neither is stored: `Payment` has no payment
method field (card/UPI/netbanking — Razorpay Checkout doesn't return
this to the integrating backend), and there's no separate "transaction
ID" concept beyond the two Razorpay IDs already in the schema
(`razorpayOrderId`, `razorpayPaymentId`). Rather than adding a new field
to satisfy an optional, hedged requirement (against "modify schema only
if absolutely necessary"), both are omitted from the list view, and
`razorpayPaymentId` is shown under its own accurate label. This is also
why the Payment Details field list in the brief itself doesn't mention
either — it's more precise, and matches what's actually built.

## 3. Design decisions

- **Admin payment oversight lives in `modules/admin/`, not
  `modules/payments/`** — mirroring Module 3C's established convention
  exactly (`AdminCourseService` in `modules/admin/courses.service.ts`
  for read-only admin oversight of the Course domain; the identical
  pattern is used here for the Payment domain via
  `AdminPaymentService`/`admin.repository.ts`). Student-facing payment
  reads (`listPaymentsForStudent`, `findPaymentDetailForStudent`) stay
  on the existing `PaymentRepository` from Module 4A — same repository,
  new methods, since that's already the student's own payment data's
  home.
- **Ownership scoping happens at the query, not after the fact.**
  `listPaymentsForStudent`/`findPaymentDetailForStudent` both filter by
  `userId`/`studentId` directly in the `where` clause — a student's
  payment list is never fetched broadly and filtered in memory. A
  student requesting someone else's payment ID gets the same 404 as a
  nonexistent one; they learn nothing about whether it exists.
- **No admin detail *page*, even though the brief's Backend section
  explicitly asks for `GET /admin/payments/:paymentId`.** The Frontend
  section's deliverable list names exactly three pages (My Payments,
  Payment Details, Admin Payment Management) and doesn't include a
  fourth "admin detail" page — so the endpoint was built (it's an
  explicit, unambiguous backend requirement) and tested, but no
  dedicated frontend page consumes it yet. The admin list already shows
  Student/Course/Amount/Status/Date, covering everything the brief asks
  the admin page to display.
- **Search-by-student and search-by-course are two independent text
  inputs, not one combined search box** — the brief lists them as two
  separate bullet points ("Search by student name" / "Search by
  course"), and a combined single box would require guessing which
  field a given query string was meant to match. Both can be active
  together, further narrowing results, along with the status filter.
- **"Sort by newest" is the fixed default ordering, not a toggle** — the
  brief doesn't mention "oldest first" or any other order, so there's
  nothing to toggle between; both the student list and the admin list
  are always `createdAt: 'desc'`.
- **The "Purchased" badge required a real fix, not just reusing an
  existing check** — the Course Details page (Module 4A) already showed
  "Continue Learning" for an enrolled course, but the *Browse Courses*
  grid (`CourseCard`, `/courses`) showed a raw price for every course
  with no enrollment awareness at all, for anyone, always. That page is
  a Server Component and can't read the client-side JWT to know who's
  asking — so `CourseGrid.tsx` (new) is the minimal client boundary:
  fetch the student's own enrollments once, client-side, via the
  already-existing `GET /enrollments/me` (Module 3A), and pass
  `isPurchased` per card. `CourseCard` itself got one new optional prop;
  its price/progress-bar branching logic already existed, and the
  "Purchased" branch was added alongside it, not in place of it — a
  course still enrolled via "My Courses" continues to show its progress
  bar, which is more informative than a bare "Purchased" label. Neither
  the Course Details page nor the Search page (which never showed a
  price to begin with) needed any change.
- **No navigation was added for the admin payments page.** Checked
  directly: *no* existing admin sub-page (courses, teachers, students,
  settings, announcements) has an in-app navigation link anywhere — they're
  all reachable only by direct URL today. Adding a nav link for payments
  specifically, while every sibling page has none, would be inventing a
  new pattern rather than reusing one. `/admin/payments` is reachable the
  same way every other admin page already is.
- **A student-side Navbar link *was* added** (`My Payments`, next to the
  existing `Profile` link) — unlike the admin case, this genuinely
  mirrors an existing precedent: `Profile` already gets a persistent
  Navbar link for a student, so this is applying that same convention to
  a new page in the same category, not inventing a new one.

## 4. Backend

**Extended (Module 4A's `payments` module):**
`payments.types.ts` (`PaymentListItem`, `PaymentDetail`,
`listPaymentsForStudent`/`findPaymentDetailForStudent` on the
repository interface), `payments.repository.ts`, `payments.service.ts`
(`listMyPayments`, `getMyPaymentDetail`), `payments.controller.ts`,
`payments.routes.ts`, `payments.validators.ts` (pagination + `paymentId`
param schemas).

**Extended (Module 3C's `admin` module):**
`admin.types.ts` (`AdminPaymentRecord`, `AdminPaymentDetail`,
`AdminPaymentFilters`, `listAllPayments`/`findPaymentDetail` on the
repository interface), `admin.repository.ts`, new
`modules/admin/payments.service.ts` (`AdminPaymentService`, mirroring
`courses.service.ts`'s exact shape — no write methods at all, matching
"no editing, no deleting, no refunds"), `admin.controller.ts`,
`admin.routes.ts`, `admin.validators.ts` (`paymentSearchQuerySchema`).

**Endpoints:**
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/payments/me` | Student | Own payments, newest first |
| GET | `/payments/me/:paymentId` | Student | Own payment detail (404 if not theirs) |
| GET | `/admin/payments` | Admin | Every payment; `student`/`course`/`status` filters |
| GET | `/admin/payments/:id` | Admin | Any payment's detail |

## 5. Frontend

**New pages:** `student/payments/page.tsx` (My Payments — table),
`student/payments/[id]/page.tsx` (Payment Details — read-only field
list), `admin/payments/page.tsx` (Payment Management — table with two
search inputs + status filter).

**New component:** `components/course/CourseGrid.tsx` (client wrapper
adding "Purchased" awareness to the Browse Courses grid).

**Modified:** `components/course/CourseCard.tsx` (`isPurchased` prop),
`(public)/courses/page.tsx` (uses `CourseGrid` instead of a raw
`.map()`), `components/Navbar.tsx` (My Payments link for students),
`types/api.ts` (new types).

All three new pages use `authFetchPaginated` (not the plain `authFetch`
used by some earlier pages, which silently discards `meta` since it only
unwraps `{data}`) — the correct client for an endpoint that genuinely
returns `{data, meta}`, verified by reading `lib/api-client.ts`'s actual
unwrapping logic rather than copying a nearby page's usage blindly.

## 6. Testing

**Backend: 26 new tests.** `tests/unit/payments/payments.service.test.ts`
gained `listMyPayments` (ownership scoping, newest-first ordering,
pagination) and `getMyPaymentDetail` (success, cross-student 404,
nonexistent-payment 404) — 8 new tests. New
`tests/unit/admin/payments.service.test.ts` (7 tests) covers
`listPayments` (no filter, student-name filter, course-title filter,
status filter, all three combined) and `getPaymentDetail`. 268 backend
tests total, all passing.

**Live-verified** (routing/RBAC/validation — this sandbox has no real
Prisma client, so response *content* can't be exercised end-to-end):
all four new endpoints reach real business logic with the correct role
and are rejected with the correct status for every wrong role (Teacher
and Student both `403` from `/admin/payments*`; Teacher `403`,
anonymous `401` from `/payments/me*`); query-parameter validation
accepts `student`/`course`/`status` together; all three new frontend
pages return `200` with zero error-boundary indicators; the Browse
Courses page still renders (and still handles the "couldn't load"
case identically to before) with the new `CourseGrid` wrapper in place.
Confirmed via the live OpenAPI spec that all four endpoints are
documented with zero parser errors (73 total paths, up from 69).

## 7. Known gaps / deferred (explicitly out of scope per the brief)

Refunds, coupons, invoices, GST, subscriptions, wallet, promo codes,
email/SMS receipts, analytics, charts, exports (CSV/PDF), webhooks,
automatic reconciliation, scheduled cleanup jobs — none built, matching
the brief exactly. No admin detail *page* (see §3) — the endpoint exists
if a future module wants it.
