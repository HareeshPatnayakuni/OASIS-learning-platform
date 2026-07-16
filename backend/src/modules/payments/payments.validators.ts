import { z } from 'zod';

export const courseIdParamsSchema = z.object({ courseId: z.string().uuid() });

export const verifyPaymentBodySchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});
export type VerifyPaymentBody = z.infer<typeof verifyPaymentBodySchema>;
