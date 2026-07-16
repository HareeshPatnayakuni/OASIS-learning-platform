import type { Request, Response } from 'express';
import { PrismaPaymentRepository } from './payments.repository';
import { PrismaEnrollmentRepository } from '../enrollments/enrollments.repository';
import { PaymentService } from './payments.service';
import type { VerifyPaymentBody } from './payments.validators';

export class PaymentController {
  private readonly service = new PaymentService(new PrismaPaymentRepository(), new PrismaEnrollmentRepository());

  initiatePurchase = async (req: Request, res: Response): Promise<void> => {
    const { courseId } = req.params as { courseId: string };
    const result = await this.service.initiatePurchase(req.user!.id, courseId);
    const status = result.type === 'CHECKOUT_REQUIRED' ? 201 : 200;
    res.status(status).json({ data: result });
  };

  verifyPayment = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as VerifyPaymentBody;
    const result = await this.service.verifyPayment(req.user!.id, body);
    res.status(200).json({ data: result });
  };
}
