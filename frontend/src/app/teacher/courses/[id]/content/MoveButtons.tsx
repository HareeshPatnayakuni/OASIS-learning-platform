'use client';

export function MoveButtons({
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={disableUp}
        aria-label="Move up"
        className="rounded px-1 text-neutral-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={disableDown}
        aria-label="Move down"
        className="rounded px-1 text-neutral-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
