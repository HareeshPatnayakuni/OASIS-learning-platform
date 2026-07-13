import type { Request, Response } from 'express';
import { PrismaEnrollmentRepository } from './enrollments.repository';
import { EnrollmentService } from './enrollments.service';

export class EnrollmentController {
  private readonly service = new EnrollmentService(new PrismaEnrollmentRepository());

  listMyCourses = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.listMyCourses(req.user!.id);
    res.status(200).json({ data });
  };
}
