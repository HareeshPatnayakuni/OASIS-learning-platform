'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { ChapterWithModules } from '@/types/api';

interface CourseSyllabusProps {
  chapters: ChapterWithModules[];
  isEnrolled: boolean;
  /** When provided, lectures become clickable and this is called with the
   * lecture ID — used by the Course Player. Omit for the read-only
   * Course Details preview. */
  onSelectLecture?: (lectureId: string) => void;
  activeLectureId?: string;
}

function formatDuration(durationSec: number | null): string {
  if (!durationSec) return '';
  const minutes = Math.round(durationSec / 60);
  return `${minutes} min`;
}

export function CourseSyllabus({
  chapters,
  isEnrolled,
  onSelectLecture,
  activeLectureId,
}: CourseSyllabusProps) {
  const [openChapterIds, setOpenChapterIds] = useState<Set<string>>(
    () => new Set(chapters[0] ? [chapters[0].id] : []),
  );

  function toggleChapter(id: string): void {
    setOpenChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
      {chapters.map((chapter, chapterIndex) => {
        const isOpen = openChapterIds.has(chapter.id);
        const lectureCount = chapter.modules.reduce((sum, m) => sum + m.lectures.length, 0);

        return (
          <div key={chapter.id}>
            <button
              type="button"
              onClick={() => toggleChapter(chapter.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <span className="font-medium text-neutral-900">
                {chapterIndex + 1}. {chapter.title}
              </span>
              <span className="flex items-center gap-2 text-xs text-neutral-500">
                {lectureCount} lecture{lectureCount === 1 ? '' : 's'}
                <svg
                  className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>

            {isOpen ? (
              <div className="space-y-4 bg-neutral-50/50 px-4 pb-4">
                {chapter.modules.map((mod) => (
                  <div key={mod.id}>
                    <p className="mb-2 pt-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                      {mod.title}
                    </p>
                    <ul className="space-y-1">
                      {mod.lectures.map((lecture) => {
                        const locked = !isEnrolled;
                        const isActive = lecture.id === activeLectureId;
                        const clickable = Boolean(onSelectLecture) && !locked;

                        return (
                          <li key={lecture.id}>
                            <button
                              type="button"
                              disabled={!clickable}
                              onClick={() => clickable && onSelectLecture?.(lecture.id)}
                              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                                isActive
                                  ? 'bg-brand-50 text-brand-700'
                                  : clickable
                                    ? 'text-neutral-700 hover:bg-white'
                                    : 'text-neutral-400'
                              } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              {locked ? (
                                <LockIcon />
                              ) : lecture.progress?.isCompleted ? (
                                <CheckIcon />
                              ) : (
                                <PlayIcon />
                              )}
                              <span className="flex-1 truncate">{lecture.title}</span>
                              {lecture.durationSec ? (
                                <span className="shrink-0 text-xs text-neutral-400">
                                  {formatDuration(lecture.durationSec)}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                      {mod.notes.map((note) => (
                        <li key={note.id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-neutral-500">
                          <NoteIcon />
                          <span className="flex-1 truncate">{note.title}</span>
                          {!isEnrolled ? <Badge tone="locked">Locked</Badge> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
