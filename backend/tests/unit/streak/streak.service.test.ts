import { StreakService } from '../../../src/modules/streak/streak.service';
import type { StreakRepository, StreakSnapshot } from '../../../src/modules/streak/streak.types';

function createFakeStreakRepository(): StreakRepository & { _state: Map<string, StreakSnapshot> } {
  const state = new Map<string, StreakSnapshot>();
  return {
    _state: state,
    async getStreak(studentId) {
      return state.get(studentId) ?? null;
    },
    async upsertStreak(studentId, data) {
      state.set(studentId, data);
      return data;
    },
  };
}

const STUDENT_ID = 'student-1';

describe('StreakService.getStreak', () => {
  it('returns a zeroed snapshot for a student with no recorded activity', async () => {
    const service = new StreakService(createFakeStreakRepository());
    await expect(service.getStreak(STUDENT_ID)).resolves.toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
    });
  });
});

describe('StreakService.recordActivity', () => {
  it('starts a streak at 1 on first-ever activity', async () => {
    const service = new StreakService(createFakeStreakRepository());
    const result = await service.recordActivity(STUDENT_ID, new Date('2026-01-10T09:00:00Z'));
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it('does not change the streak for a second activity on the same calendar day', async () => {
    const repo = createFakeStreakRepository();
    const service = new StreakService(repo);
    await service.recordActivity(STUDENT_ID, new Date('2026-01-10T09:00:00Z'));

    const result = await service.recordActivity(STUDENT_ID, new Date('2026-01-10T21:00:00Z'));
    expect(result.currentStreak).toBe(1);
  });

  it('increments the streak for activity exactly one calendar day later', async () => {
    const repo = createFakeStreakRepository();
    const service = new StreakService(repo);
    await service.recordActivity(STUDENT_ID, new Date('2026-01-10T09:00:00Z'));

    const result = await service.recordActivity(STUDENT_ID, new Date('2026-01-11T09:00:00Z'));
    expect(result.currentStreak).toBe(2);
  });

  it('builds a multi-day streak correctly across consecutive days', async () => {
    const repo = createFakeStreakRepository();
    const service = new StreakService(repo);
    await service.recordActivity(STUDENT_ID, new Date('2026-01-10T09:00:00Z'));
    await service.recordActivity(STUDENT_ID, new Date('2026-01-11T09:00:00Z'));
    const result = await service.recordActivity(STUDENT_ID, new Date('2026-01-12T09:00:00Z'));
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it('resets the streak to 1 after a gap of 2 or more days', async () => {
    const repo = createFakeStreakRepository();
    const service = new StreakService(repo);
    await service.recordActivity(STUDENT_ID, new Date('2026-01-10T09:00:00Z'));
    await service.recordActivity(STUDENT_ID, new Date('2026-01-11T09:00:00Z')); // streak = 2

    const result = await service.recordActivity(STUDENT_ID, new Date('2026-01-14T09:00:00Z')); // 3-day gap
    expect(result.currentStreak).toBe(1);
  });

  it('preserves longestStreak as a high-water mark after a reset', async () => {
    const repo = createFakeStreakRepository();
    const service = new StreakService(repo);
    await service.recordActivity(STUDENT_ID, new Date('2026-01-10T09:00:00Z'));
    await service.recordActivity(STUDENT_ID, new Date('2026-01-11T09:00:00Z'));
    await service.recordActivity(STUDENT_ID, new Date('2026-01-12T09:00:00Z')); // streak = 3, longest = 3

    const result = await service.recordActivity(STUDENT_ID, new Date('2026-01-20T09:00:00Z')); // reset
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(3); // unchanged, still the high-water mark
  });

  it('treats midnight-crossing activity within the same UTC calendar day correctly', async () => {
    const repo = createFakeStreakRepository();
    const service = new StreakService(repo);
    await service.recordActivity(STUDENT_ID, new Date('2026-01-10T23:50:00Z'));
    const result = await service.recordActivity(STUDENT_ID, new Date('2026-01-11T00:10:00Z'));
    // 20 minutes apart in real time, but a different calendar day -> increments
    expect(result.currentStreak).toBe(2);
  });
});
