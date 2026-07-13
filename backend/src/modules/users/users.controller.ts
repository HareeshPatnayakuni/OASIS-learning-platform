import type { Request, Response } from 'express';
import { PrismaUsersRepository } from './users.repository';
import { UserService } from './users.service';
import { PrismaCatalogRepository } from '../catalog/catalog.repository';
import { StreakService } from '../streak/streak.service';
import { PrismaStreakRepository } from '../streak/streak.repository';
import type { PaginationQuery, UpdateProfileBody } from './users.validators';

export class UserController {
  private readonly service = new UserService(new PrismaUsersRepository(), new PrismaCatalogRepository());
  private readonly streakService = new StreakService(new PrismaStreakRepository());

  getMe = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.service.getProfile(req.user!.id);
    res.status(200).json({ data: profile });
  };

  updateMe = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as UpdateProfileBody;
    const profile = await this.service.updateProfile(req.user!.id, body);
    res.status(200).json({ data: profile });
  };

  getMyStreak = async (req: Request, res: Response): Promise<void> => {
    const streak = await this.streakService.getStreak(req.user!.id);
    res.status(200).json({ data: streak });
  };

  getMyContinueWatching = async (req: Request, res: Response): Promise<void> => {
    const items = await this.service.listContinueWatching(req.user!.id);
    res.status(200).json({ data: items });
  };

  getMyAnnouncements = async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = req.query as unknown as PaginationQuery;
    const result = await this.service.listAnnouncements(req.user!.id, page, limit);
    res.status(200).json(result);
  };
}
