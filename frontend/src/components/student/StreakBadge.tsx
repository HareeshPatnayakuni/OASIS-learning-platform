import type { StreakSnapshot } from '@/types/api';

export function StreakBadge({ streak }: { streak: StreakSnapshot }) {
  const hasStreak = streak.currentStreak > 0;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${
          hasStreak ? 'bg-accent-400/20' : 'bg-neutral-100'
        }`}
        aria-hidden="true"
      >
        🔥
      </div>
      <div>
        <p className="text-lg font-semibold text-neutral-900">
          {streak.currentStreak} day{streak.currentStreak === 1 ? '' : 's'}
        </p>
        <p className="text-xs text-neutral-500">
          {hasStreak ? 'Current streak' : 'Complete a lecture today to start a streak'} · Best:{' '}
          {streak.longestStreak}
        </p>
      </div>
    </div>
  );
}
