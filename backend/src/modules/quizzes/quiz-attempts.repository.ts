import { prisma } from '../../lib/prisma';
import type { QuizAttemptRecord, QuizAttemptRepository } from './quiz-attempts.types';

export class PrismaQuizAttemptRepository implements QuizAttemptRepository {
  async findQuizForAccess(quizId: string): Promise<{ courseId: string } | null> {
    // Quiz has no status field of its own (docs/03-database-design.md
    // §2.3 — visibility is inherited entirely from the parent Course's
    // status), so the course's own status/deletedAt is checked directly
    // here, the same way the syllabus query (courses.repository.ts)
    // checks it for the whole course tree.
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: quizId,
        deletedAt: null,
        module: { deletedAt: null, chapter: { deletedAt: null, course: { status: 'PUBLISHED', deletedAt: null } } },
      },
      select: { module: { select: { chapter: { select: { courseId: true } } } } },
    });
    if (!quiz) return null;
    return { courseId: quiz.module.chapter.courseId };
  }

  async createAttempt(
    quizId: string,
    studentId: string,
    score: number,
    totalMarks: number,
  ): Promise<QuizAttemptRecord> {
    return await prisma.quizAttempt.create({
      data: { quizId, studentId, score, totalMarks },
    });
  }

  async findLatestAttempt(quizId: string, studentId: string): Promise<QuizAttemptRecord | null> {
    return await prisma.quizAttempt.findFirst({
      where: { quizId, studentId },
      orderBy: { attemptedAt: 'desc' },
    });
  }
}
