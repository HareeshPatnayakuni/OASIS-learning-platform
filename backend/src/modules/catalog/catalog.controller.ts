import type { Request, Response } from 'express';
import { PrismaCatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';

export class CatalogController {
  private readonly service = new CatalogService(new PrismaCatalogRepository());

  listBoards = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.listBoards();
    res.status(200).json({ data });
  };

  listClassGrades = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.listClassGrades();
    res.status(200).json({ data });
  };

  listSubjects = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.listSubjects();
    res.status(200).json({ data });
  };
}
