import { AdminPaymentService } from '../../../src/modules/admin/payments.service';
import { createFakeAdminRepository } from './fakeAdminRepository';
import type { AdminPaymentRecord } from '../../../src/modules/admin/admin.types';

function buildPayment(overrides: Partial<AdminPaymentRecord> = {}): AdminPaymentRecord {
  return {
    id: 'payment-1',
    amount: 999,
    currency: 'INR',
    status: 'SUCCESS',
    createdAt: new Date('2026-01-01'),
    student: { id: 'student-1', fullName: 'Aisha Khan', email: 'aisha@oasis.example.com' },
    course: { id: 'course-1', title: 'CBSE Class 8 Mathematics', slug: 'cbse-class-8-mathematics' },
    ...overrides,
  };
}

describe('AdminPaymentService.listPayments', () => {
  it('lists every payment across every student and course, newest first', async () => {
    const { repo } = createFakeAdminRepository({
      payments: [
        buildPayment({ id: 'payment-1', createdAt: new Date('2026-01-01') }),
        buildPayment({ id: 'payment-2', createdAt: new Date('2026-02-01') }),
      ],
    });
    const service = new AdminPaymentService(repo);

    const result = await service.listPayments({}, 1, 20);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe('payment-2');
    expect(result.meta.total).toBe(2);
  });

  it('filters by student name (partial, case-insensitive)', async () => {
    const { repo } = createFakeAdminRepository({
      payments: [
        buildPayment({ id: 'payment-1', student: { id: 's1', fullName: 'Aisha Khan', email: 'a@x.com' } }),
        buildPayment({ id: 'payment-2', student: { id: 's2', fullName: 'Rohan Verma', email: 'r@x.com' } }),
      ],
    });
    const service = new AdminPaymentService(repo);

    const result = await service.listPayments({ student: 'aisha' }, 1, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('payment-1');
  });

  it('filters by course title (partial, case-insensitive)', async () => {
    const { repo } = createFakeAdminRepository({
      payments: [
        buildPayment({ id: 'payment-1', course: { id: 'c1', title: 'CBSE Class 8 Mathematics', slug: 'x' } }),
        buildPayment({ id: 'payment-2', course: { id: 'c2', title: 'ICSE Class 6 Science', slug: 'y' } }),
      ],
    });
    const service = new AdminPaymentService(repo);

    const result = await service.listPayments({ course: 'science' }, 1, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('payment-2');
  });

  it('filters by status', async () => {
    const { repo } = createFakeAdminRepository({
      payments: [
        buildPayment({ id: 'payment-1', status: 'SUCCESS' }),
        buildPayment({ id: 'payment-2', status: 'FAILED' }),
      ],
    });
    const service = new AdminPaymentService(repo);

    const result = await service.listPayments({ status: 'FAILED' }, 1, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('payment-2');
  });

  it('combines student, course, and status filters together', async () => {
    const { repo } = createFakeAdminRepository({
      payments: [
        buildPayment({
          id: 'payment-1',
          status: 'SUCCESS',
          student: { id: 's1', fullName: 'Aisha Khan', email: 'a@x.com' },
          course: { id: 'c1', title: 'CBSE Class 8 Mathematics', slug: 'x' },
        }),
        buildPayment({
          id: 'payment-2',
          status: 'FAILED',
          student: { id: 's1', fullName: 'Aisha Khan', email: 'a@x.com' },
          course: { id: 'c1', title: 'CBSE Class 8 Mathematics', slug: 'x' },
        }),
      ],
    });
    const service = new AdminPaymentService(repo);

    const result = await service.listPayments({ student: 'aisha', course: 'mathematics', status: 'SUCCESS' }, 1, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('payment-1');
  });
});

describe('AdminPaymentService.getPaymentDetail', () => {
  it('returns detail for any payment, regardless of which student made it', async () => {
    const { repo } = createFakeAdminRepository({
      payments: [buildPayment({ id: 'payment-1' })],
    });
    const service = new AdminPaymentService(repo);

    const detail = await service.getPaymentDetail('payment-1');

    expect(detail.id).toBe('payment-1');
    expect(detail.razorpayOrderId).toBeDefined();
  });

  it('404s for a payment that does not exist', async () => {
    const { repo } = createFakeAdminRepository({ payments: [] });
    const service = new AdminPaymentService(repo);

    await expect(service.getPaymentDetail('nope')).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
      statusCode: 404,
    });
  });
});
