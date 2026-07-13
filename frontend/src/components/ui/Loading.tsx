export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-neutral-500" role="status">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-neutral-200 p-4">
      <div className="mb-3 h-32 rounded-lg bg-neutral-100" />
      <div className="mb-2 h-4 w-3/4 rounded bg-neutral-100" />
      <div className="h-4 w-1/2 rounded bg-neutral-100" />
    </div>
  );
}
