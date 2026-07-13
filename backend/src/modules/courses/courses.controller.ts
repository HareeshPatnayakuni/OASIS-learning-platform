import type { Request, Response } from 'express';
import { PrismaCourseRepository } from './courses.repository';
import { CourseService } from './courses.service';
import type { CourseSlugParams, ListCoursesQuery } from './courses.validators';

export class CourseController {
  private readonly service = new CourseService(new PrismaCourseRepository());

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListCoursesQuery;
    const result = await this.service.listCourses(query);
    res.status(200).json(result);
  };

  detail = async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params as unknown as CourseSlugParams;
    // optionalAuthenticate (not authenticate) guards this route — req.user
    // may or may not be set. Only a STUDENT's own enrollment is ever
    // relevant here, so any other role is treated the same as anonymous.
    const studentId = req.user?.role === 'STUDENT' ? req.user.id : undefined;
    const course = await this.service.getCourseDetail(slug, studentId);
    res.status(200).json({ data: course });
  };
}
