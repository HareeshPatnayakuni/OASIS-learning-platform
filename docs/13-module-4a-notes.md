# Module 4A — Implementation Notes
## Payments Foundation

## 1. What was already there vs. what was built

Module 1's original schema design anticipated this module thoroughly:
`Payment` model, `PaymentStatus` enum (`PENDING`/`SUCCESS`/`FAILED`/
`REFUNDED`), `Enrollment.paymentId` (nullable — a free/scholarship
enrollment never needed a real payment row), and even the
`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` env
vars, already in `config/env.ts` and both `.env.example` files. This
module built the actual business logic and endpoints on top of that
groundwork — it didn't invent the data model from scratch.

**The one real schema gap found and fixed**: `Payment.courseId` existed
as a plain string with no `@relation` to `Course` at all — no
enforced foreign key. Added `course Course @relation(...)` and the
`Course.payments Payment[]` back-relation, plus a new
`@@index([userId, courseId])` (alongside the existing
`@@index([userId, status])`) for the retry/duplicate-check lookup
pattern. Everything else in the `Payment` model is untouched.

## 2. Design decisions

- **One purchase endpoint, not two.** `POST /courses/:courseId/purchase`
  decides free-vs-paid itself, server-side, every time — the frontend
  never tells the backend which path to take. This is a real security
  requirement (never trust the client with pricing), not just tidiness.
- **A Payment row is created at order-creation time (status `PENDING`),
  not only after verification.** Read literally, "create payment record
  only after successful verification" could mean a payment row shouldn't
  exist at all until it's confirmed — but that would mean an invalid or
  abandoned Razorpay order leaves zero trace, and "Payment Storage: ...
  status" only makes sense if status can genuinely vary. The row is
  created `PENDING` when the order is, then updated to `SUCCESS` or
  `FAILED` at verify time — matching how `PaymentStatus`'s own enum
  values are clearly meant to be used, and giving a real audit trail
  for abandoned/failed attempts instead of silently losing them.
- **Retry is "click Buy Now again," not "resume a stale order."** Every
  purchase attempt (first try or retry after a failure) creates a fresh
  Razorpay order and a fresh `PENDING` Payment row — there's no logic to
  find and reuse a previous pending attempt. This is deliberately the
  simplest correct design per the brief's own "keep solutions simple":
  multiple `PENDING`/`FAILED` rows accumulating for the same
  (student, course) pair across retries is normal and expected (this is
  how real payment gateway integrations work); the `Enrollment` table
  — gated by the existing `@@unique([studentId, courseId])` — is what
  actually controls access, and it's created exactly once regardless of
  how many attempts preceded it.
- **`discountPrice ?? price` is the effective charge amount** — this
  field already existed (teacher-settable, already displayed to
  students on the Course Details page as a strikethrough-vs-current
  price), so honoring it for the actual charge is "reuse existing
  architecture," not a new discount *system*. No coupon codes, no
  customer-facing promo mechanism — just correctly reading a field
  that was already there and already shown to the student before they
  click Buy.
- **`markPaymentSuccessAndEnroll` wraps the payment update and enrollment
  creation in a single Prisma transaction** — this was a genuine gap
  found during Module 4A's final review, not the original design: the
  first pass had these as two separate, non-atomic writes
  (`markPaymentSuccess` then `EnrollmentRepository.createEnrollment`). A
  crash, dropped connection, or any error between the two could leave a
  payment marked `SUCCESS` with no corresponding enrollment — a paying
  student with no access and no automatic way to recover. Fixed by
  combining both writes into one `PaymentRepository` method backed by
  `prisma.$transaction([...])` (the array form — no inter-step data
  dependency existed between the two writes, so the simpler form was
  sufficient; the interactive callback form wasn't needed). The
  enrollment write within it is an `upsert`, not find-then-create,
  closing a narrow concurrent-double-callback race at the same time.
  This intentionally introduces a small, acknowledged overlap with
  `EnrollmentRepository.createEnrollment`'s own upsert-shaped logic — the
  alternative (threading a transaction client through both repositories'
  interfaces) was judged a larger change for a narrower benefit. The
  free-course path and the already-`SUCCESS` idempotent-reverify path
  still use the simpler, unchanged `createEnrollment` — neither has a
  matching payment write to pair atomically with in the first place.
- **Enrollment creation lives in the `enrollments` module, not
  `payments`.** Added `findEnrollment`/`createEnrollment` to the
  existing (previously read-only) `EnrollmentRepository`/
  `PrismaEnrollmentRepository`, and `PaymentService` depends on that
  repository directly — Enrollment CRUD has one home regardless of what
  triggers it (a payment today; conceivably an Admin-granted scholarship
  later), rather than duplicating "insert an enrollment row" logic
  inside the payments module.
- **`lib/razorpay.ts` mirrors `lib/r2.ts`'s exact pattern**: build the
  client lazily from env vars that are `.optional()` at the schema
  level (already the case — not changed here), return `null` if
  unconfigured, and throw a dedicated `RazorpayNotConfiguredError` only
  at the point something actually tries to use it. The app boots fine
  without Razorpay configured; only initiating a paid purchase fails,
  with a clear message, exactly like R2 without credentials only fails
  an actual upload/download.
- **Checkout signature verification uses the SDK's own
  `validatePaymentVerification` helper**, not a hand-rolled HMAC
  comparison — this is exactly the kind of security-critical code where
  reusing the vendor's tested implementation beats reimplementing it.
  This is a *different* mechanism from `validateWebhookSignature`
  (different HMAC input shape) — webhooks are explicitly out of scope
  for this module, so only the checkout-verification helper is used.
- **React Query and React Hook Form were not introduced**, despite
  being named in the tech stack for this task. Neither is used anywhere
  in the existing frontend (every other page uses plain `useState` +
  `authFetch`), and this feature is one button with no multi-field form
  — introducing two new dependencies and a different data-fetching
  pattern for this alone would be exactly the over-engineering the brief
  explicitly warns against. If a later module has a genuinely complex
  form or a page with heavy client-side caching needs, that's the more
  natural place to introduce them.

## 3. What was built

**Database** (`database/schema.prisma`): the `Payment`↔`Course`
relation fix described above. `Enrollment` and `PaymentStatus` used
exactly as they already were.

**Backend** (`backend/src/modules/payments/`): `payments.types.ts`,
`payments.repository.ts`, `payments.service.ts`, `payments.validators.ts`,
`payments.controller.ts`, `payments.routes.ts` — the same
types→repository→service→controller→routes shape as every other
module. Plus `backend/src/lib/razorpay.ts` (new) and two additive
methods on the existing `enrollments` module.

**Endpoints:**
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/courses/{courseId}/purchase` | Student | Enroll (free) or create a Razorpay order (paid) |
| POST | `/payments/verify` | Student | Verify a completed checkout; only this creates the Enrollment for a paid course |

**Frontend**: `frontend/src/lib/razorpay.ts` (new — loads the Checkout
script, typed `window.Razorpay`), and `CourseDetailClient.tsx`'s
`EnrollmentCta` rewritten from a permanently-disabled placeholder button
into the real flow: free courses enroll immediately; paid courses open
Razorpay Checkout, with loading/error/cancelled states and a smooth
transition to "Continue Learning" on success — no page reload, no new
design system introduced.

## 4. Access control — confirmed unchanged, not rebuilt

"Paid lectures remain inaccessible until enrollment exists" is already
true today, for free: `ContentService.getLectureStreamUrl`/
`getNoteDownloadUrl` (Module 3A) already call
`ContentRepository.isStudentEnrolled(studentId, courseId)` — a query
against the exact same `Enrollment` table/unique constraint this
module's `createEnrollment` writes to — fresh, on every single request,
never cached. The moment a real `Enrollment` row exists, access follows
automatically. Verified this is genuinely the mechanism (not assumed)
by reading `content.repository.ts`'s `isStudentEnrolled` directly.
Zero lines of the content module were touched.

## 5. Security checklist

- `RAZORPAY_KEY_SECRET` never leaves the backend — only `keyId` (the
  public, non-secret key ID) is ever included in an API response.
- Every signature is verified server-side via the SDK's own helper
  before any Payment/Enrollment write happens.
- Ownership is checked in `verifyPayment`: a student can only verify a
  payment where `payment.userId === requestingStudentId`, even if they
  somehow obtained a different student's `razorpayOrderId`.
- Duplicate callback processing is handled by checking `payment.status
  === 'SUCCESS'` first and short-circuiting to the existing enrollment,
  never re-processing or double-charging logic.
- Duplicate enrollment is structurally prevented by the pre-existing
  `@@unique([studentId, courseId])` constraint, backed by
  `createEnrollment`'s own find-before-create check.
- The course itself is re-validated (`PUBLISHED`, not deleted) on every
  purchase attempt — an Admin archiving or a Teacher un-publishing a
  course between page load and button click can't be bypassed by a
  stale frontend price/status.

## 6. Testing

**Backend: 14 unit tests** (`tests/unit/payments/payments.service.test.ts`,
13 from the original implementation plus 1 added during final review to
explicitly cover the transaction fix — see §2),
mocking `lib/razorpay.ts` (the one external dependency `PaymentService`
can't avoid touching) and using an in-memory fake for both
`PaymentRepository` and `EnrollmentRepository`, matching this project's
established testing pattern throughout. Covers: free enrollment (no
Razorpay call at all), `discountPrice` taking priority, order creation
for a paid course, already-enrolled short-circuit, non-existent/
non-published course rejection, successful verification, invalid-signature
rejection (payment marked `FAILED`, no enrollment), cross-student
ownership rejection, missing-payment rejection, and two idempotency
tests (re-verifying an already-`SUCCESS` payment, and calling verify
twice in a row for the same fresh success) confirming no duplicate
enrollment is ever created. 256 backend tests total, all passing.

**Live-verified** (this sandbox has no real Razorpay credentials, so
full checkout can't be exercised end-to-end here, but routing/auth/
validation were): booted the server and confirmed `POST /courses/{id}/
purchase` and `POST /payments/verify` both require a Student token
(`403` for Teacher, `401` for none), reach real business logic with a
Student token (stub-boundary `500`, not a routing/validation error),
correctly `400` on a malformed verify body, and are both present with
zero parser errors in the generated OpenAPI spec (69 total paths).

## 7. Known gaps / deferred (explicitly out of scope per the brief)

Coupons, discounts-as-a-system, wallet, subscriptions, refunds,
invoices (the schema's `Payment.invoiceUrl` field exists but is never
populated by this module), GST, promo codes, email/SMS receipts,
payment analytics, webhooks (`RAZORPAY_WEBHOOK_SECRET` exists in
config but nothing reads it — Razorpay Checkout's client-side callback
plus server-side signature verification is sufficient for this MVP;
webhooks would add resilience against a closed browser tab mid-payment,
which is a real gap but an explicitly deferred one), an Admin finance
dashboard, and international payments. A stale `PENDING` payment row
from an abandoned checkout is never cleaned up automatically (no
scheduled job) — harmless (it grants no access), but worth noting for a
future module if the `payments` table's size becomes a concern.

## 8. Migration note (sandbox limitation, unchanged from every prior module)

`prisma migrate dev` cannot run in this sandbox (no network path to
`binaries.prisma.sh`). The schema change is written and correct;
generate the actual migration with
`npx prisma migrate dev --name add_payment_course_relation` in a real
environment. No other schema or migration changes are needed.

---

## Quick reference

```bash
# Backend
cd backend && npm run dev          # http://localhost:4000

# Frontend (separate terminal)
cd frontend && npm run dev         # http://localhost:3000

npm test        # backend: 255 tests
npm run lint    # both packages
npm run build   # both packages
```
