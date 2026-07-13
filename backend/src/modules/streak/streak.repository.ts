import { prisma } from '../../lib/prisma';
import type { StreakRepository, StreakSnapshot } from './streak.types';

export class PrismaStreakRepository implements StreakRepository {
  async getStreak(studentId: string): Promise<StreakSnapshot | null> {
    const row = await prisma.learningStreak.findUnique({ where: { studentId } });
    if (!row) return null;
    return {
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak,
      lastActiveDate: row.lastActiveDate,
    };
  }

  async upsertStreak(studentId: string, data: StreakSnapshot): Promise<StreakSnapshot> {
    const row = await prisma.learningStreak.upsert({
      where: { studentId },
      create: {
        studentId,
        currentStreak: data.currentStreak,
        longestStreak: data.longestStreak,
        lastActiveDate: data.lastActiveDate,
      },
      update: {
        currentStreak: data.currentStreak,
        longestStreak: data.longestStreak,
        lastActiveDate: data.lastActiveDate,
      },
    });
    return {
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak,
      lastActiveDate: row.lastActiveDate,
    };
  }
}
