import { prisma } from '../../lib/prisma';
import type { CreateQuizInput, QuizRecord, QuizRepository, UpdateQuizInput } from './quizzes.types';

const quizSelect = {
  id: true,
  moduleId: true,
  title: true,
  passPercent: true,
  questions: {
    orderBy: { order: 'asc' as const },
    select: {
      id: true,
      text: true,
      order: true,
      options: { select: { id: true, text: true, isCorrect: true } },
    },
  },
} as const;

export class PrismaQuizRepository implements QuizRepository {
  async createQuiz(moduleId: string, input: CreateQuizInput): Promise<QuizRecord> {
    return await prisma.quiz.create({
      data: {
        moduleId,
        title: input.title,
        passPercent: input.passPercent ?? 40,
        questions: {
          create: input.questions.map((q, index) => ({
            text: q.text,
            order: index + 1,
            options: { create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
          })),
        },
      },
      select: quizSelect,
    });
  }

  async findQuizById(id: string): Promise<QuizRecord | null> {
    return await prisma.quiz.findFirst({ where: { id, deletedAt: null }, select: quizSelect });
  }

  async updateQuiz(id: string, input: UpdateQuizInput): Promise<QuizRecord> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.passPercent !== undefined) data.passPercent = input.passPercent;

    if (input.questions !== undefined) {
      // Wholesale replace — see the module doc comment in quizzes.types.ts.
      // Deleting the existing questions cascades to their options
      // (schema: Question/QuestionOption onDelete: Cascade), so this is
      // safe as a single nested write within one transaction.
      await prisma.$transaction([
        prisma.question.deleteMany({ where: { quizId: id } }),
        prisma.quiz.update({
          where: { id },
          data: {
            ...data,
            questions: {
              create: input.questions.map((q, index) => ({
                text: q.text,
                order: index + 1,
                options: { create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
              })),
            },
          },
        }),
      ]);
    } else if (Object.keys(data).length > 0) {
      await prisma.quiz.update({ where: { id }, data });
    }

    return (await this.findQuizById(id))!;
  }

  async softDeleteQuiz(id: string): Promise<void> {
    await prisma.quiz.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
