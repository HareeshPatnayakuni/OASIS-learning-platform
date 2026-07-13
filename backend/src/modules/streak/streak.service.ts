import type { StreakRepository, StreakSnapshot } from './streak.types';

const EMPTY_STREAK: StreakSnapshot = { currentStreak: 0, longestStreak: 0, lastActiveDate: null };

/**
 * "Calendar day" is deliberately UTC, not server-local time. Using the
 * server's local timezone would make streak boundaries silently shift
 * depending on which region a given deployment runs in (Render/Railway/
 * DigitalOcean/AWS all default their containers to UTC in practice, but
 * nothing guarantees that stays true forever, or that every host does).
 * Pinning to UTC explicitly means the same activity timestamps always
 * produce the same streak, everywhere, permanently.
 */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function diffInCalendarDays(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((startOfUtcDay(a).getTime() - startOfUtcDay(b).getTime()) / MS_PER_DAY);
}

export class StreakService {
  constructor(private readonly repo: StreakRepository) {}

  async getStreak(studentId: string): Promise<StreakSnapshot> {
    const existing = await this.repo.getStreak(studentId);
    return existing ?? EMPTY_STREAK;
  }

  /**
   * Called whenever a student does something that counts as "activity" —
   * currently, updating lecture progress (content.service.ts). The rule:
   *   - First-ever activity, or a gap of 2+ days since the last one:
   *     streak resets to 1.
   *   - Activity again today (same calendar day as last recorded):
   *     no change — this makes the function idempotent within a day,
   *     so watching 5 lectures today doesn't inflate the streak to 5.
   *   - Activity exactly one calendar day after the last one: streak
   *     increments by 1.
   * `longestStreak` is a running high-water mark, never decreases.
   *
   * `now` is an injectable parameter (defaults to `new Date()`) purely so
   * this is deterministically testable — see streak.service.test.ts.
   */
  async recordActivity(studentId: string, now: Date = new Date()): Promise<StreakSnapshot> {
    const existing = await this.repo.getStreak(studentId);

    if (!existing || !existing.lastActiveDate) {
      return this.repo.upsertStreak(studentId, {
        currentStreak: 1,
        longestStreak: Math.max(1, existing?.longestStreak ?? 0),
        lastActiveDate: startOfUtcDay(now),
      });
    }

    const dayDiff = diffInCalendarDays(now, existing.lastActiveDate);

    if (dayDiff === 0) {
      return existing; // already recorded today
    }

    const currentStreak = dayDiff === 1 ? existing.currentStreak + 1 : 1;
    const longestStreak = Math.max(existing.longestStreak, currentStreak);

    return this.repo.upsertStreak(studentId, {
      currentStreak,
      longestStreak,
      lastActiveDate: startOfUtcDay(now),
    });
  }
}
