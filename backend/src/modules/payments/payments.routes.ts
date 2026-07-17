import { Router } from 'express';
import { PaymentController } from './payments.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { courseIdParamsSchema, paginationQuerySchema, paymentIdParamsSchema, verifyPaymentBodySchema } from './payments.validators';

const router = Router();
const controller = new PaymentController();
const studentOnly = [authenticate, requireRole('STUDENT')] as const;

/**
 * @openapi
 * /courses/{courseId}/purchase:
 *   post:
 *     tags: [Payments]
 *     summary: Enroll in a course — immediately if free, via a Razorpay order if paid
 *     description: >
 *       The single entry point for the Purchase button. The frontend
 *       never decides free-vs-paid itself; this endpoint always
 *       re-checks the course's real price server-side. Returns one of
 *       three discriminated shapes: `ALREADY_ENROLLED` (no new order —
 *       duplicate purchase protection), `ENROLLED` (free course,
 *       enrolled immediately, no Razorpay involved), or
 *       `CHECKOUT_REQUIRED` (paid course — open Razorpay Checkout with
 *       the returned order details).
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: courseId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Already enrolled, no action taken }
 *       201: { description: Enrolled (free course) or a Razorpay order was created (paid course) }
 *       404: { description: Course not found or not published }
 */
router.post(
  '/courses/:courseId/purchase',
  ...studentOnly,
  validate({ params: courseIdParamsSchema }),
  asyncHandler(controller.initiatePurchase),
);

/**
 * @openapi
 * /payments/verify:
 *   post:
 *     tags: [Payments]
 *     summary: Verify a completed Razorpay checkout and enroll the student
 *     description: >
 *       Never trusts the frontend's "payment succeeded" claim alone —
 *       verifies the Razorpay signature server-side (the secret key
 *       never leaves the backend) before creating the Payment success
 *       record and the Enrollment. Idempotent: calling this again for an
 *       already-verified payment returns the same enrollment rather than
 *       erroring or double-enrolling.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpayOrderId, razorpayPaymentId, razorpaySignature]
 *             properties:
 *               razorpayOrderId: { type: string }
 *               razorpayPaymentId: { type: string }
 *               razorpaySignature: { type: string }
 *     responses:
 *       200: { description: Payment verified and enrollment created (or already had been) }
 *       400: { description: Signature verification failed — payment not completed }
 *       403: { description: This payment does not belong to the requesting student }
 *       404: { description: Payment not found }
 */
router.post(
  '/payments/verify',
  ...studentOnly,
  validate({ body: verifyPaymentBodySchema }),
  asyncHandler(controller.verifyPayment),
);

/**
 * @openapi
 * /payments/me:
 *   get:
 *     tags: [Payments]
 *     summary: The requesting student's own payments, newest first
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated payment list }
 */
router.get(
  '/payments/me',
  ...studentOnly,
  validate({ query: paginationQuerySchema }),
  asyncHandler(controller.listMyPayments),
);

/**
 * @openapi
 * /payments/me/{paymentId}:
 *   get:
 *     tags: [Payments]
 *     summary: Detail of one of the requesting student's own payments
 *     description: >
 *       Read-only. Returns 404 whether the payment doesn't exist or
 *       belongs to a different student — a student probing other
 *       payment IDs learns nothing either way.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: paymentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Payment detail }
 *       404: { description: Payment not found (or not this student's) }
 */
router.get(
  '/payments/me/:paymentId',
  ...studentOnly,
  validate({ params: paymentIdParamsSchema }),
  asyncHandler(controller.getPaymentDetail),
);

export { router as paymentsRouter };
