import type { Request, Response } from 'express';
import { PrismaQuizRepository } from './quizzes.repository';
import { PrismaQuizAttemptRepository } from './quiz-attempts.repository';
import { PrismaContentRepository } from '../content/content.repository';
import { QuizAttemptService } from './quiz-attempts.service';
import type { QuizIdNestedParams, SubmitAnswersBody } from './quiz-attempts.validators';

export class QuizAttemptController {
  private readonly service = new QuizAttemptService(
    new PrismaQuizRepository(),
    new PrismaQuizAttemptRepository(),
    new PrismaContentRepository(),
  );

  getQuizForAttempt = async (req: Request, res: Response): Promise<void> => {
    const { quizId } = req.params as unknown as QuizIdNestedParams;
    const quiz = await this.service.getQuizForAttempt(quizId, req.user!.id);
    res.status(200).json({ data: quiz });
  };

  submitQuizAttempt = async (req: Request, res: Response): Promise<void> => {
    const { quizId } = req.params as unknown as QuizIdNestedParams;
    const body = req.body as SubmitAnswersBody;
    const result = await this.service.submitQuizAttempt(quizId, req.user!.id, body);
    res.status(201).json({ data: result });
  };

  getMyLatestAttempt = async (req: Request, res: Response): Promise<void> => {
    const { quizId } = req.params as unknown as QuizIdNestedParams;
    const attempt = await this.service.getMyLatestAttempt(quizId, req.user!.id);
    res.status(200).json({ data: attempt });
  };
}
