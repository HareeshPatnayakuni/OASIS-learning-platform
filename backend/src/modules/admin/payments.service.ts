import { ApiError } from '../../utils/ApiError';
import type { AdminPaymentDetail, AdminPaymentFilters, AdminPaymentRecord, AdminRepository } from './admin.types';

export interface PaymentListResult {
  data: AdminPaymentRecord[];
  meta: { page: number; limit: number; total: number };
}

/**
 * Read-only, per the brief: list and view detail only. No editing, no
 * deleting, no refunds — there isn't a single write method on this
 * service, so there's nothing to structurally lock down the way
 * `AdminCourseService`'s content-editing exclusion needed a comment;
 * the absence speaks for itself.
 */
export class AdminPaymentService {
  constructor(private readonly repo: AdminRepository) {}

  async listPayments(filters: AdminPaymentFilters, page: number, limit: number): Promise<PaymentListResult> {
    const { data, total } = await this.repo.listAllPayments(filters, page, limit);
    return { data, meta: { page, limit, total } };
  }

  async getPaymentDetail(id: string): Promise<AdminPaymentDetail> {
    const payment = await this.repo.findPaymentDetail(id);
    if (!payment) {
      throw ApiError.notFound('PAYMENT_NOT_FOUND', 'Payment not found');
    }
    return payment;
  }
}
