import { PaymentService } from '../../../src/modules/payments/payments.service';
import type {
  PaymentRecord,
  PaymentRepository,
  PurchasableCourse,
} from '../../../src/modules/payments/payments.types';
import type { EnrollmentRepository } from '../../../src/modules/enrollments/enrollments.types';

const mockCreateOrder = jest.fn<
  Promise<{ razorpayOrderId: string; amount: number; currency: string; keyId: string }>,
  [amountInRupees: number, receipt: string]
>();
const mockVerifyCheckoutSignature = jest.fn<
  boolean,
  [{ razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }]
>();

jest.mock('../../../src/lib/razorpay', () => ({
  createOrder: (amountInRupees: number, receipt: string) => mockCreateOrder(amountInRupees, receipt),
  verifyCheckoutSignature: (params: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    mockVerifyCheckoutSignature(params),
}));

const STUDENT_ID = 'student-1';
const COURSE_ID = 'course-1';

function buildCourse(overrides: Partial<PurchasableCourse> = {}): PurchasableCourse {
  return { id: COURSE_ID, price: 999, discountPrice: null, status: 'PUBLISHED', ...overrides };
}

function buildPayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'payment-1',
    userId: STUDENT_ID,
    courseId: COURSE_ID,
    amount: 999,
    currency: 'INR',
    razorpayOrderId: 'order_abc123',
    razorpayPaymentId: null,
    status: 'PENDING',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function createFakeRepos(seed: {
  course?: PurchasableCourse | null;
  enrollments?: Map<string, { id: string }>;
  payments?: Map<string, PaymentRecord>;
} = {}) {
  const course = seed.course === undefined ? buildCourse() : seed.course;
  const enrollments = seed.enrollments ?? new Map<string, { id: string }>();
  const payments = seed.payments ?? new Map<string, PaymentRecord>();
  const markedFailed: string[] = [];
  const markedSuccess: Array<{ paymentId: string; razorpayPaymentId: string; razorpaySignature: string }> = [];

  const paymentRepo: PaymentRepository = {
    async findCourseForPurchase() {
      return course;
    },
    async createPendingPayment(input) {
      const record = buildPayment({
        id: `payment-${payments.size + 1}`,
        userId: input.userId,
        courseId: input.courseId,
        amount: input.amount,
        razorpayOrderId: input.razorpayOrderId,
        status: 'PENDING',
      });
      payments.set(record.razorpayOrderId, record);
      return record;
    },
    async findPaymentByOrderId(razorpayOrderId) {
      return payments.get(razorpayOrderId) ?? null;
    },
    async markPaymentSuccessAndEnroll(paymentId, studentId, courseId, razorpayPaymentId, razorpaySignature) {
      markedSuccess.push({ paymentId, razorpayPaymentId, razorpaySignature });
      for (const [key, p] of payments) {
        if (p.id === paymentId) payments.set(key, { ...p, status: 'SUCCESS', razorpayPaymentId });
      }
      const enrollmentKey = `${studentId}:${courseId}`;
      const existing = enrollments.get(enrollmentKey);
      if (existing) return { enrollmentId: existing.id };
      const record = { id: `enrollment-${enrollments.size + 1}` };
      enrollments.set(enrollmentKey, record);
      return { enrollmentId: record.id };
    },
    async markPaymentFailed(paymentId) {
      markedFailed.push(paymentId);
      for (const [key, p] of payments) {
        if (p.id === paymentId) payments.set(key, { ...p, status: 'FAILED' });
      }
    },
    async listPaymentsForStudent(studentId, page, limit) {
      const mine = [...payments.values()]
        .filter((p) => p.userId === studentId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const data = mine.slice((page - 1) * limit, page * limit).map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
        razorpayPaymentId: p.razorpayPaymentId,
        course: { id: p.courseId, title: 'CBSE Class 8 Mathematics', slug: 'cbse-class-8-mathematics' },
      }));
      return { data, total: mine.length };
    },
    async findPaymentDetailForStudent(paymentId, studentId) {
      const payment = [...payments.values()].find((p) => p.id === paymentId && p.userId === studentId);
      if (!payment) return null;
      return {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        createdAt: payment.createdAt,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: payment.razorpayPaymentId,
        course: { id: payment.courseId, title: 'CBSE Class 8 Mathematics', slug: 'cbse-class-8-mathematics' },
      };
    },
  };

  const enrollmentRepo: EnrollmentRepository = {
    async listEnrollmentsForStudent() {
      return [];
    },
    async countPublishedLecturesInCourse() {
      return 0;
    },
    async countCompletedLecturesForStudentInCourse() {
      return 0;
    },
    async findEnrollment(studentId, courseId) {
      return enrollments.get(`${studentId}:${courseId}`) ?? null;
    },
    async createEnrollment(studentId, courseId, paymentId) {
      const key = `${studentId}:${courseId}`;
      const existing = enrollments.get(key);
      if (existing) return existing;
      const record = { id: `enrollment-${enrollments.size + 1}` };
      enrollments.set(key, record);
      void paymentId;
      return record;
    },
  };

  return { paymentRepo, enrollmentRepo, enrollments, payments, markedFailed, markedSuccess };
}

beforeEach(() => {
  mockCreateOrder.mockReset();
  mockVerifyCheckoutSignature.mockReset();
});

describe('PaymentService.initiatePurchase', () => {
  it('enrolls immediately for a free course, without creating any Payment or calling Razorpay', async () => {
    const { paymentRepo, enrollmentRepo, enrollments } = createFakeRepos({
      course: buildCourse({ price: 0, discountPrice: null }),
    });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    const result = await service.initiatePurchase(STUDENT_ID, COURSE_ID);

    expect(result.type).toBe('ENROLLED');
    if (result.type !== 'ENROLLED') throw new Error('expected ENROLLED');
    expect(result.enrollmentId).toEqual(expect.any(String));
    expect(enrollments.size).toBe(1);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('treats a discounted price of 0 as free too', async () => {
    const { paymentRepo, enrollmentRepo } = createFakeRepos({
      course: buildCourse({ price: 999, discountPrice: 0 }),
    });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    const result = await service.initiatePurchase(STUDENT_ID, COURSE_ID);
    expect(result.type).toBe('ENROLLED');
  });

  it('uses discountPrice over price when both are set', async () => {
    const { paymentRepo, enrollmentRepo } = createFakeRepos({
      course: buildCourse({ price: 999, discountPrice: 499 }),
    });
    mockCreateOrder.mockResolvedValue({
      razorpayOrderId: 'order_xyz',
      amount: 49900,
      currency: 'INR',
      keyId: 'rzp_test_key',
    });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    await service.initiatePurchase(STUDENT_ID, COURSE_ID);

    expect(mockCreateOrder).toHaveBeenCalledWith(499, expect.any(String));
  });

  it('creates a Razorpay order and a PENDING Payment for a paid course', async () => {
    const { paymentRepo, enrollmentRepo, payments } = createFakeRepos({ course: buildCourse({ price: 999 }) });
    mockCreateOrder.mockResolvedValue({
      razorpayOrderId: 'order_abc123',
      amount: 99900,
      currency: 'INR',
      keyId: 'rzp_test_key',
    });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    const result = await service.initiatePurchase(STUDENT_ID, COURSE_ID);

    expect(result.type).toBe('CHECKOUT_REQUIRED');
    if (result.type !== 'CHECKOUT_REQUIRED') throw new Error('expected CHECKOUT_REQUIRED');
    expect(result.paymentId).toEqual(expect.any(String));
    expect(result).toMatchObject({
      type: 'CHECKOUT_REQUIRED',
      razorpayOrderId: 'order_abc123',
      amount: 99900,
      currency: 'INR',
      keyId: 'rzp_test_key',
    });
    expect(payments.get('order_abc123')?.status).toBe('PENDING');
  });

  it('returns ALREADY_ENROLLED and never touches Razorpay if already enrolled', async () => {
    const { paymentRepo, enrollmentRepo } = createFakeRepos({
      enrollments: new Map([[`${STUDENT_ID}:${COURSE_ID}`, { id: 'existing-enrollment' }]]),
    });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    const result = await service.initiatePurchase(STUDENT_ID, COURSE_ID);

    expect(result).toEqual({ type: 'ALREADY_ENROLLED' });
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('404s for a course that does not exist', async () => {
    const { paymentRepo, enrollmentRepo } = createFakeRepos({ course: null });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    await expect(service.initiatePurchase(STUDENT_ID, COURSE_ID)).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('404s for a course that exists but is not published (DRAFT/ARCHIVED)', async () => {
    const { paymentRepo, enrollmentRepo } = createFakeRepos({ course: buildCourse({ status: 'DRAFT' }) });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    await expect(service.initiatePurchase(STUDENT_ID, COURSE_ID)).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('PaymentService.verifyPayment', () => {
  const verifyInput = {
    razorpayOrderId: 'order_abc123',
    razorpayPaymentId: 'pay_xyz789',
    razorpaySignature: 'sig_valid',
  };

  it('verifies the signature, marks the payment SUCCESS, and creates the enrollment', async () => {
    const { paymentRepo, enrollmentRepo, enrollments, markedSuccess } = createFakeRepos({
      payments: new Map([['order_abc123', buildPayment({ status: 'PENDING' })]]),
    });
    mockVerifyCheckoutSignature.mockReturnValue(true);
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    const result = await service.verifyPayment(STUDENT_ID, verifyInput);

    expect(result.type).toBe('SUCCESS');
    if (result.type !== 'SUCCESS') throw new Error('expected SUCCESS');
    expect(result.enrollmentId).toEqual(expect.any(String));
    expect(enrollments.size).toBe(1);
    expect(markedSuccess).toHaveLength(1);
    expect(markedSuccess[0]).toMatchObject({ razorpayPaymentId: 'pay_xyz789', razorpaySignature: 'sig_valid' });
  });

  it('marks the payment success and creates the enrollment through one atomic repository call, never two separate writes', async () => {
    // Regression coverage for a real data-consistency gap found during
    // Module 4A's final review: marking a payment SUCCESS and creating
    // its enrollment used to be two separate, non-transactional writes —
    // a crash between them could leave a payment marked SUCCESS with no
    // corresponding enrollment (a paying student with no access, and no
    // automatic way to recover). Fixed by requiring both to happen via
    // one PaymentRepository method backed by a single Prisma transaction
    // (see payments.repository.ts's markPaymentSuccessAndEnroll).
    const { paymentRepo, enrollmentRepo } = createFakeRepos({
      payments: new Map([['order_abc123', buildPayment({ status: 'PENDING' })]]),
    });
    mockVerifyCheckoutSignature.mockReturnValue(true);
    const atomicSpy = jest.spyOn(paymentRepo, 'markPaymentSuccessAndEnroll');
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    await service.verifyPayment(STUDENT_ID, verifyInput);

    expect(atomicSpy).toHaveBeenCalledTimes(1);
    expect(atomicSpy).toHaveBeenCalledWith('payment-1', STUDENT_ID, COURSE_ID, 'pay_xyz789', 'sig_valid');
  });

  it('never trusts the frontend: an invalid signature marks the payment FAILED and does not enroll', async () => {
    const { paymentRepo, enrollmentRepo, enrollments, markedFailed } = createFakeRepos({
      payments: new Map([['order_abc123', buildPayment({ status: 'PENDING' })]]),
    });
    mockVerifyCheckoutSignature.mockReturnValue(false);
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    await expect(service.verifyPayment(STUDENT_ID, verifyInput)).rejects.toMatchObject({
      code: 'INVALID_SIGNATURE',
      statusCode: 400,
    });
    expect(enrollments.size).toBe(0);
    expect(markedFailed).toEqual(['payment-1']);
  });

  it('rejects verifying a payment that belongs to a different student', async () => {
    const { paymentRepo, enrollmentRepo } = createFakeRepos({
      payments: new Map([['order_abc123', buildPayment({ userId: 'someone-else', status: 'PENDING' })]]),
    });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    await expect(service.verifyPayment(STUDENT_ID, verifyInput)).rejects.toMatchObject({
      code: 'NOT_PAYMENT_OWNER',
      statusCode: 403,
    });
    expect(mockVerifyCheckoutSignature).not.toHaveBeenCalled();
  });

  it('404s for a payment that does not exist', async () => {
    const { paymentRepo, enrollmentRepo } = createFakeRepos({ payments: new Map() });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    await expect(service.verifyPayment(STUDENT_ID, verifyInput)).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('is idempotent: verifying an already-SUCCESS payment again returns the same enrollment without re-checking the signature', async () => {
    const { paymentRepo, enrollmentRepo, enrollments } = createFakeRepos({
      payments: new Map([['order_abc123', buildPayment({ status: 'SUCCESS' })]]),
      enrollments: new Map([[`${STUDENT_ID}:${COURSE_ID}`, { id: 'enrollment-existing' }]]),
    });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    const result = await service.verifyPayment(STUDENT_ID, verifyInput);

    expect(result).toEqual({ type: 'ALREADY_PROCESSED', enrollmentId: 'enrollment-existing' });
    expect(mockVerifyCheckoutSignature).not.toHaveBeenCalled();
    expect(enrollments.size).toBe(1);
  });

  it('never creates a duplicate enrollment even if verify is somehow called twice for a fresh success', async () => {
    const { paymentRepo, enrollmentRepo, enrollments } = createFakeRepos({
      payments: new Map([['order_abc123', buildPayment({ status: 'PENDING' })]]),
    });
    mockVerifyCheckoutSignature.mockReturnValue(true);
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    await service.verifyPayment(STUDENT_ID, verifyInput);
    // Second call: repo fake now reports status SUCCESS, matching real DB behavior
    const secondResult = await service.verifyPayment(STUDENT_ID, verifyInput);

    expect(secondResult.type).toBe('ALREADY_PROCESSED');
    expect(enrollments.size).toBe(1);
  });
});

describe('PaymentService.listMyPayments', () => {
  it('returns only the requesting student\'s own payments, newest first', async () => {
    const older = buildPayment({
      id: 'payment-1',
      razorpayOrderId: 'order_1',
      createdAt: new Date('2026-01-01'),
    });
    const newer = buildPayment({
      id: 'payment-2',
      razorpayOrderId: 'order_2',
      createdAt: new Date('2026-02-01'),
    });
    const someoneElses = buildPayment({
      id: 'payment-3',
      userId: 'other-student',
      razorpayOrderId: 'order_3',
      createdAt: new Date('2026-03-01'),
    });
    const { paymentRepo, enrollmentRepo } = createFakeRepos({
      payments: new Map([
        ['order_1', older],
        ['order_2', newer],
        ['order_3', someoneElses],
      ]),
    });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    const result = await service.listMyPayments(STUDENT_ID, 1, 20);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe('payment-2');
    expect(result.data[1]?.id).toBe('payment-1');
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 2 });
  });

  it('paginates correctly', async () => {
    const { paymentRepo, enrollmentRepo } = createFakeRepos({
      payments: new Map([
        ['order_1', buildPayment({ id: 'payment-1', razorpayOrderId: 'order_1' })],
        ['order_2', buildPayment({ id: 'payment-2', razorpayOrderId: 'order_2' })],
      ]),
    });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    const result = await service.listMyPayments(STUDENT_ID, 1, 1);

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(2);
  });
});

describe('PaymentService.getMyPaymentDetail', () => {
  it("returns the payment's detail when it belongs to the requesting student", async () => {
    const { paymentRepo, enrollmentRepo } = createFakeRepos({
      payments: new Map([['order_abc123', buildPayment({ id: 'payment-1' })]]),
    });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    const detail = await service.getMyPaymentDetail(STUDENT_ID, 'payment-1');

    expect(detail.id).toBe('payment-1');
    expect(detail.razorpayOrderId).toBe('order_abc123');
  });

  it("404s for a payment that belongs to a different student — same as if it didn't exist", async () => {
    const { paymentRepo, enrollmentRepo } = createFakeRepos({
      payments: new Map([['order_abc123', buildPayment({ id: 'payment-1', userId: 'other-student' })]]),
    });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    await expect(service.getMyPaymentDetail(STUDENT_ID, 'payment-1')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('404s for a payment that does not exist at all', async () => {
    const { paymentRepo, enrollmentRepo } = createFakeRepos({ payments: new Map() });
    const service = new PaymentService(paymentRepo, enrollmentRepo);

    await expect(service.getMyPaymentDetail(STUDENT_ID, 'nope')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
      statusCode: 404,
    });
  });
});
