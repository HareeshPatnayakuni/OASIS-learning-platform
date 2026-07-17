import { z } from 'zod';

export const courseIdParamsSchema = z.object({ courseId: z.string().uuid() });

export const verifyPaymentBodySchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});
export type VerifyPaymentBody = z.infer<typeof verifyPaymentBodySchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paymentIdParamsSchema = z.object({ paymentId: z.string().uuid() });
