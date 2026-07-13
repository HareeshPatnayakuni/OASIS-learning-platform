import type { Request, Response } from 'express';
import { PrismaContentRepository } from './content.repository';
import { ContentService } from './content.service';
import { StreakService } from '../streak/streak.service';
import { PrismaStreakRepository } from '../streak/streak.repository';
import type { LectureIdParams, NoteIdParams, UpdateProgressBody } from './content.validators';

export class ContentController {
  private readonly service = new ContentService(
    new PrismaContentRepository(),
    new StreakService(new PrismaStreakRepository()),
  );

  getLectureStreamUrl = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as unknown as LectureIdParams;
    const result = await this.service.getLectureStreamUrl(id, req.user!.id);
    res.status(200).json({ data: result });
  };

  getNoteDownloadUrl = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as unknown as NoteIdParams;
    const result = await this.service.getNoteDownloadUrl(id, req.user!.id);
    res.status(200).json({ data: result });
  };

  updateLectureProgress = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as unknown as LectureIdParams;
    const body = req.body as UpdateProgressBody;
    const result = await this.service.updateLectureProgress(id, req.user!.id, body);
    res.status(200).json({ data: result });
  };
}
