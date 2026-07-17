import type { PaymentStatus } from '@prisma/client';

/**
 * Module 4A — Payments Foundation. Explicit MVP scope per the brief: a
 * free course enrolls immediately (no Razorpay involved at all, no
 * Payment row created — matches the schema's own long-standing comment
 * on `Enrollment.paymentId` being nullable for exactly this reason); a
 * paid course goes through Razorpay Checkout, verified server-side
 * before an Enrollment is ever created. No coupons, refunds, invoices,
 * webhooks, or subscriptions — those are explicitly out of scope and
 * belong to a future module.
 */

export interface PaymentRecord {
  id: string;
  userId: string;
  courseId: string;
  amount: number; // rupees, matching Course.price's convention (Razorpay's paise conversion happens only in lib/razorpay.ts)
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  status: PaymentStatus;
  createdAt: Date;
}

export interface PurchasableCourse {
  id: string;
  price: number;
  discountPrice: number | null;
  status: string;
}

/** Discriminated result for POST /courses/:courseId/purchase — the
 * frontend branches on `type` to decide whether to redirect to "My
 * Courses" (already enrolled / just enrolled free) or open Razorpay
 * Checkout (payment required). */
export type PurchaseResult =
  | { type: 'ALREADY_ENROLLED' }
  | { type: 'ENROLLED'; enrollmentId: string }
  | {
      type: 'CHECKOUT_REQUIRED';
      paymentId: string;
      razorpayOrderId: string;
      amount: number; // paise — what Razorpay Checkout's own `amount` option expects
      currency: string;
      keyId: string;
    };

export interface VerifyPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/** `ALREADY_PROCESSED` is a legitimate, non-error outcome — not a retry
 * bug — for a payment that was already verified successfully (e.g. a
 * duplicate callback, or the user's browser retrying a slow request).
 * `enrollmentId` is the same either way; the frontend doesn't need to
 * distinguish these to decide what to show the student next. */
export type VerifyResult =
  | { type: 'SUCCESS'; enrollmentId: string }
  | { type: 'ALREADY_PROCESSED'; enrollmentId: string };

// ── Module 4B — Payment Management (read-only) ──────────────────────

export interface PaymentListItem {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  razorpayPaymentId: string | null;
  course: { id: string; title: string; slug: string };
}

/** Superset of `PaymentListItem` — the detail view additionally shows
 * the Razorpay order ID, which the list view (matching the brief's own
 * field list) doesn't. */
export interface PaymentDetail extends PaymentListItem {
  razorpayOrderId: string;
}

export interface PaymentRepository {
  findCourseForPurchase(courseId: string): Promise<PurchasableCourse | null>;
  createPendingPayment(input: {
    userId: string;
    courseId: string;
    amount: number;
    razorpayOrderId: string;
  }): Promise<PaymentRecord>;
  findPaymentByOrderId(razorpayOrderId: string): Promise<PaymentRecord | null>;
  markPaymentFailed(paymentId: string): Promise<void>;
  /**
   * Atomically marks the payment SUCCESS and creates the enrollment in a
   * single Prisma transaction — the one place these two writes must
   * both happen or neither does. A crash, dropped connection, or any
   * error between two *separate* writes here would leave a payment
   * marked SUCCESS with no corresponding enrollment: a paying student
   * with no access, and no automatic way to notice or recover. The
   * enrollment write is an `upsert` (not find-then-create) so a
   * concurrent duplicate call can't race past a stale read.
   */
  markPaymentSuccessAndEnroll(
    paymentId: string,
    studentId: string,
    courseId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<{ enrollmentId: string }>;
  /** Newest first, per the brief. Scoped to `studentId` at the query
   * level (not filtered after the fact) — a student can only ever see
   * rows that are already theirs. */
  listPaymentsForStudent(
    studentId: string,
    page: number,
    limit: number,
  ): Promise<{ data: PaymentListItem[]; total: number }>;
  /** Returns `null` if the payment doesn't exist *or* doesn't belong to
   * `studentId` — same 404 either way, so a student probing other
   * payment IDs learns nothing about whether they exist. */
  findPaymentDetailForStudent(paymentId: string, studentId: string): Promise<PaymentDetail | null>;
}
