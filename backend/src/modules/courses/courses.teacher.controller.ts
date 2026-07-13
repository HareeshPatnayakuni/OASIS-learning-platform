import type { Request, Response } from 'express';
import { PrismaTeacherCourseRepository } from './courses.teacher.repository';
import { TeacherCourseService } from './courses.teacher.service';
import type {
  CourseIdParams,
  CreateCourseBody,
  UpdateCourseBody,
  UpdateCourseStatusBody,
} from './courses.teacher.validators';

export class TeacherCourseController {
  private readonly service = new TeacherCourseService(new PrismaTeacherCourseRepository());

  listMine = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.listMyCourses(req.user!.id);
    res.status(200).json({ data });
  };

  getMine = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as unknown as CourseIdParams;
    const course = await this.service.getMyCourseById(id, req.user!.id);
    res.status(200).json({ data: course });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateCourseBody;
    const course = await this.service.createCourse(req.user!.id, body);
    res.status(201).json({ data: course });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as unknown as CourseIdParams;
    const body = req.body as UpdateCourseBody;
    const course = await this.service.updateCourse(id, req.user!.id, body);
    res.status(200).json({ data: course });
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as unknown as CourseIdParams;
    const { status } = req.body as UpdateCourseStatusBody;
    const course = await this.service.updateCourseStatus(id, req.user!.id, status);
    res.status(200).json({ data: course });
  };
}
