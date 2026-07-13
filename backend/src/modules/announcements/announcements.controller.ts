import type { Request, Response } from 'express';
import { PrismaTeacherAnnouncementRepository } from './announcements.repository';
import { TeacherAnnouncementService } from './announcements.service';
import type {
  CreateAnnouncementBody,
  PaginationQuery,
  UpdateAnnouncementBody,
} from './announcements.validators';

export class TeacherAnnouncementController {
  private readonly service = new TeacherAnnouncementService(new PrismaTeacherAnnouncementRepository());

  create = async (req: Request, res: Response): Promise<void> => {
    const { courseId } = req.params as { courseId: string };
    const body = req.body as CreateAnnouncementBody;
    const announcement = await this.service.createAnnouncement(courseId, req.user!.id, body);
    res.status(201).json({ data: announcement });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const body = req.body as UpdateAnnouncementBody;
    const announcement = await this.service.updateAnnouncement(id, req.user!.id, body);
    res.status(200).json({ data: announcement });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.service.deleteAnnouncement(id, req.user!.id);
    res.status(204).send();
  };

  listMine = async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = req.query as unknown as PaginationQuery;
    const result = await this.service.listMyAnnouncements(req.user!.id, page, limit);
    res.status(200).json(result);
  };
}
