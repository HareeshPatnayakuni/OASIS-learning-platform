/**
 * Learning Streak (Student Dashboard feature). This module has no routes
 * of its own — `StreakService` is consumed by the `content` module (which
 * records activity when a student updates lecture progress) and the
 * `users` module (which exposes GET /users/me/streak). Kept as its own
 * small module so both can depend on it without depending on each other.
 */

export interface StreakSnapshot {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
}

export interface StreakRepository {
  getStreak(studentId: string): Promise<StreakSnapshot | null>;
  upsertStreak(studentId: string, data: StreakSnapshot): Promise<StreakSnapshot>;
}
