import type { Request, Response } from 'express';
import { PrismaQuizRepository } from './quizzes.repository';
import { QuizzesService } from './quizzes.service';
import type { CreateQuizBody, UpdateQuizBody } from './quizzes.validators';

export class QuizzesController {
  private readonly service = new QuizzesService(new PrismaQuizRepository());

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const quiz = await this.service.getQuiz(id, req.user!.id);
    res.status(200).json({ data: quiz });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { moduleId } = req.params as { moduleId: string };
    const body = req.body as CreateQuizBody;
    const quiz = await this.service.createQuiz(moduleId, req.user!.id, body);
    res.status(201).json({ data: quiz });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const body = req.body as UpdateQuizBody;
    const quiz = await this.service.updateQuiz(id, req.user!.id, body);
    res.status(200).json({ data: quiz });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.service.deleteQuiz(id, req.user!.id);
    res.status(204).send();
  };
}
