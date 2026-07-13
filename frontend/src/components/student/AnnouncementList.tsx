import type { AnnouncementItem } from '@/types/api';
import { EmptyState } from '@/components/ui/States';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AnnouncementList({ announcements }: { announcements: AnnouncementItem[] }) {
  if (announcements.length === 0) {
    return (
      <EmptyState
        title="No announcements yet"
        description="Updates from your teachers will show up here."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {announcements.map((announcement) => (
        <li key={announcement.id} className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="font-medium text-neutral-900">{announcement.title}</p>
            <span className="shrink-0 text-xs text-neutral-400">{formatDate(announcement.createdAt)}</span>
          </div>
          <p className="text-sm text-neutral-600">{announcement.body}</p>
          <p className="mt-2 text-xs text-neutral-400">
            {announcement.course.title} · {announcement.author.fullName}
          </p>
        </li>
      ))}
    </ul>
  );
}
