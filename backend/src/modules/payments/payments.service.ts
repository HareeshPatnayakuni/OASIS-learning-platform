import { ApiError } from '../../utils/ApiError';
import { createOrder, verifyCheckoutSignature } from '../../lib/razorpay';
import type { EnrollmentRepository } from '../enrollments/enrollments.types';
import type {
  PaymentDetail,
  PaymentListItem,
  PaymentRepository,
  PurchaseResult,
  VerifyPaymentInput,
  VerifyResult,
} from './payments.types';

export class PaymentService {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
  ) {}

  /**
   * The one entry point for the Purchase button — the frontend never
   * decides free-vs-paid itself (never trust the client with pricing);
   * this always re-checks the course's real price server-side and
   * branches accordingly.
   */
  async initiatePurchase(studentId: string, courseId: string): Promise<PurchaseResult> {
    // Duplicate purchase protection — checked first, before touching
    // Razorpay at all, so a re-click or a stale frontend never creates a
    // second order for a course the student already has access to.
    const existingEnrollment = await this.enrollmentRepo.findEnrollment(studentId, courseId);
    if (existingEnrollment) {
      return { type: 'ALREADY_ENROLLED' };
    }

    const course = await this.paymentRepo.findCourseForPurchase(courseId);
    // A DRAFT/ARCHIVED (or deleted, or nonexistent) course can't be
    // purchased — same 404 either way, matching the public course-detail
    // endpoint's own "a non-published course doesn't exist from a
    // student's perspective" convention, rather than leaking which case
    // it was.
    if (!course || course.status !== 'PUBLISHED') {
      throw ApiError.notFound('COURSE_NOT_FOUND', 'Course not found');
    }

    const effectivePrice = course.discountPrice ?? course.price;

    if (effectivePrice <= 0) {
      const enrollment = await this.enrollmentRepo.createEnrollment(studentId, courseId);
      return { type: 'ENROLLED', enrollmentId: enrollment.id };
    }

    // Razorpay's receipt field is capped at 40 characters.
    const receipt = `course_${courseId}`.slice(0, 32) + '_' + Date.now().toString(36);
    const order = await createOrder(effectivePrice, receipt.slice(0, 40));
    const payment = await this.paymentRepo.createPendingPayment({
      userId: studentId,
      courseId,
      amount: effectivePrice,
      razorpayOrderId: order.razorpayOrderId,
    });

    return {
      type: 'CHECKOUT_REQUIRED',
      paymentId: payment.id,
      razorpayOrderId: order.razorpayOrderId,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
    };
  }

  /**
   * Never trusts the frontend's "payment succeeded" claim on its own —
   * the Razorpay signature is the actual proof, verified here against
   * the secret key, which never leaves the backend. Enrollment is only
   * ever created *after* this check passes.
   */
  async verifyPayment(studentId: string, input: VerifyPaymentInput): Promise<VerifyResult> {
    const payment = await this.paymentRepo.findPaymentByOrderId(input.razorpayOrderId);
    if (!payment) {
      throw ApiError.notFound('PAYMENT_NOT_FOUND', 'Payment not found');
    }
    // Ownership check: a student can only verify their own payment,
    // never one initiated by someone else, even if they somehow guessed
    // or intercepted the order ID.
    if (payment.userId !== studentId) {
      throw ApiError.forbidden('NOT_PAYMENT_OWNER', 'This payment does not belong to you');
    }

    if (payment.status === 'SUCCESS') {
      // Already verified by an earlier call (e.g. a duplicated callback,
      // or the browser retrying a slow request) — createEnrollment is
      // itself idempotent (returns the existing row rather than
      // erroring), so it's safe to call again without re-checking the
      // signature.
      const enrollment = await this.enrollmentRepo.createEnrollment(studentId, payment.courseId, payment.id);
      return { type: 'ALREADY_PROCESSED', enrollmentId: enrollment.id };
    }

    const isValid = verifyCheckoutSignature({
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
    });

    if (!isValid) {
      await this.paymentRepo.markPaymentFailed(payment.id);
      throw ApiError.badRequest('INVALID_SIGNATURE', 'Payment verification failed');
    }

    const result = await this.paymentRepo.markPaymentSuccessAndEnroll(
      payment.id,
      studentId,
      payment.courseId,
      input.razorpayPaymentId,
      input.razorpaySignature,
    );

    return { type: 'SUCCESS', enrollmentId: result.enrollmentId };
  }

  /** Newest first, scoped to the requesting student at the repository
   * query level — never fetched broadly and filtered in memory. */
  async listMyPayments(
    studentId: string,
    page: number,
    limit: number,
  ): Promise<{ data: PaymentListItem[]; meta: { page: number; limit: number; total: number } }> {
    const { data, total } = await this.paymentRepo.listPaymentsForStudent(studentId, page, limit);
    return { data, meta: { page, limit, total } };
  }

  async getMyPaymentDetail(studentId: string, paymentId: string): Promise<PaymentDetail> {
    const payment = await this.paymentRepo.findPaymentDetailForStudent(paymentId, studentId);
    // Same 404 whether the payment doesn't exist or belongs to someone
    // else — a student probing other IDs learns nothing either way.
    if (!payment) {
      throw ApiError.notFound('PAYMENT_NOT_FOUND', 'Payment not found');
    }
    return payment;
  }
}
