import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'brand' | 'success' | 'locked' | 'accent';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-green-50 text-success-600',
  locked: 'bg-neutral-100 text-neutral-500',
  accent: 'bg-accent-400/20 text-accent-600',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
