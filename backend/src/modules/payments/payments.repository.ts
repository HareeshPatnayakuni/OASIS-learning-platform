import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  PaymentDetail,
  PaymentListItem,
  PaymentRecord,
  PaymentRepository,
  PurchasableCourse,
} from './payments.types';

const paymentSelect = {
  id: true,
  userId: true,
  courseId: true,
  amount: true,
  currency: true,
  razorpayOrderId: true,
  razorpayPaymentId: true,
  status: true,
  createdAt: true,
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPayment(row: any): PaymentRecord {
  return {
    id: row.id,
    userId: row.userId,
    courseId: row.courseId,
    amount: Number(row.amount),
    currency: row.currency,
    razorpayOrderId: row.razorpayOrderId,
    razorpayPaymentId: row.razorpayPaymentId,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export class PrismaPaymentRepository implements PaymentRepository {
  async findCourseForPurchase(courseId: string): Promise<PurchasableCourse | null> {
    const course = await prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      select: { id: true, price: true, discountPrice: true, status: true },
    });
    if (!course) return null;
    const c = course;
    return {
      id: c.id,
      price: Number(c.price),
      discountPrice: c.discountPrice === null ? null : Number(c.discountPrice),
      status: c.status,
    };
  }

  async createPendingPayment(input: {
    userId: string;
    courseId: string;
    amount: number;
    razorpayOrderId: string;
  }): Promise<PaymentRecord> {
    const data: Prisma.PaymentCreateInput = {
      user: { connect: { id: input.userId } },
      course: { connect: { id: input.courseId } },
      amount: input.amount,
      currency: 'INR',
      razorpayOrderId: input.razorpayOrderId,
      status: 'PENDING',
    };
    const row = await prisma.payment.create({ data, select: paymentSelect });
    return mapPayment(row);
  }

  async findPaymentByOrderId(razorpayOrderId: string): Promise<PaymentRecord | null> {
    const row = await prisma.payment.findUnique({
      where: { razorpayOrderId },
      select: paymentSelect,
    });
    return row ? mapPayment(row) : null;
  }

  async markPaymentFailed(paymentId: string): Promise<void> {
    const data: Prisma.PaymentUpdateInput = { status: 'FAILED' };
    await prisma.payment.update({ where: { id: paymentId }, data });
  }

  async markPaymentSuccessAndEnroll(
    paymentId: string,
    studentId: string,
    courseId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<{ enrollmentId: string }> {
    const updateData: Prisma.PaymentUpdateInput = {
      razorpayPaymentId,
      razorpaySignature,
      status: 'SUCCESS',
    };

    // upsert, not find-then-create: atomic at the database level, so a
    // concurrent duplicate call (e.g. a genuinely simultaneous double
    // callback) can't race past a stale read the way two separate
    // find/create calls could. Both operations run in one transaction —
    // either both commit or neither does, so a payment can never end up
    // marked SUCCESS with no corresponding enrollment.
    const [, enrollment] = await prisma.$transaction([
      prisma.payment.update({ where: { id: paymentId }, data: updateData }),
      prisma.enrollment.upsert({
        where: { studentId_courseId: { studentId, courseId } },
        create: { studentId, courseId, paymentId },
        update: {},
        select: { id: true },
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return { enrollmentId: (enrollment as { id: string }).id };
  }

  async listPaymentsForStudent(
    studentId: string,
    page: number,
    limit: number,
  ): Promise<{ data: PaymentListItem[]; total: number }> {
    const where = { userId: studentId };
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          razorpayPaymentId: true,
          course: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: (rows as any[]).map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        currency: row.currency,
        status: row.status,
        createdAt: row.createdAt,
        razorpayPaymentId: row.razorpayPaymentId,
        course: row.course,
      })),
      total,
    };
  }

  async findPaymentDetailForStudent(paymentId: string, studentId: string): Promise<PaymentDetail | null> {
    const row = await prisma.payment.findFirst({
      where: { id: paymentId, userId: studentId },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        course: { select: { id: true, title: true, slug: true } },
      },
    });
    if (!row) return null;
    const r = row;
    return {
      id: r.id,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      createdAt: r.createdAt,
      razorpayOrderId: r.razorpayOrderId,
      razorpayPaymentId: r.razorpayPaymentId,
      course: r.course,
    };
  }
}
