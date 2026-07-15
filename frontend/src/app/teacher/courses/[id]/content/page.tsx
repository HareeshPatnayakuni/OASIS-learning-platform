'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ApiClientError } from '@/lib/api-client';
import { uploadFileToSignedUrl } from '@/lib/upload';
import { InlineTextForm, EditableTitle } from './InlineEditors';
import { MoveButtons } from './MoveButtons';
import { QuizBuilder } from './QuizBuilder';
import type {
  CreateLectureResult,
  CreateNoteResult,
  LectureStatus,
  QuizDetail,
  TeacherChapterWithContent,
} from '@/types/api';

const LECTURE_STATUSES: LectureStatus[] = ['DRAFT', 'PUBLISHED', 'HIDDEN'];

function statusTone(status: LectureStatus): 'success' | 'neutral' | 'locked' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'HIDDEN') return 'locked';
  return 'neutral';
}

export default function CourseContentPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const { authFetch } = useAuth();

  const [tree, setTree] = useState<TeacherChapterWithContent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
  const [quizEditor, setQuizEditor] = useState<{ moduleId: string; quiz: QuizDetail | null } | null>(null);

  const refetch = useCallback(async () => {
    try {
      const result = await authFetch<TeacherChapterWithContent[]>(`/courses/${courseId}/content`);
      setTree(result);
      setOpenChapters((prev) => (prev.size === 0 && result[0] ? new Set([result[0].id]) : prev));
    } catch {
      setError("Couldn't load this course's content right now.");
    }
  }, [authFetch, courseId]);

  useEffect(() => {
    let cancelled = false;
    authFetch<TeacherChapterWithContent[]>(`/courses/${courseId}/content`)
      .then((result) => {
        if (cancelled) return;
        setTree(result);
        setOpenChapters((prev) => (prev.size === 0 && result[0] ? new Set([result[0].id]) : prev));
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this course's content right now.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  function toggleChapter(id: string): void {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function withErrorHandling(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => setError(null)} />;
  if (!tree) return <Spinner label="Loading course content…" />;

  return (
    <div>
      <div className="mb-6">
        <Link href={`/teacher/courses/${courseId}/edit`} className="text-sm text-neutral-500 hover:text-brand-600">
          ← Back to course details
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Course Content</h1>
        <p className="text-sm text-neutral-500">Chapters, modules, lectures, notes, and quizzes.</p>
      </div>

      {tree.length === 0 ? (
        <EmptyState title="No chapters yet" description="Add your first chapter below to get started." />
      ) : (
        <div className="mb-4 space-y-3">
          {tree.map((chapter, chapterIndex) => (
            <div key={chapter.id} className="rounded-xl border border-neutral-200 bg-white">
              <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
                <MoveButtons
                  disableUp={chapterIndex === 0}
                  disableDown={chapterIndex === tree.length - 1}
                  onMoveUp={() =>
                    void withErrorHandling(async () => {
                      await authFetch(`/chapters/${chapter.id}/move`, { method: 'PATCH', body: { direction: 'up' } });
                      await refetch();
                    })
                  }
                  onMoveDown={() =>
                    void withErrorHandling(async () => {
                      await authFetch(`/chapters/${chapter.id}/move`, {
                        method: 'PATCH',
                        body: { direction: 'down' },
                      });
                      await refetch();
                    })
                  }
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleChapter(chapter.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleChapter(chapter.id);
                    }
                  }}
                  className="flex-1 cursor-pointer text-left font-medium text-neutral-900"
                >
                  {chapterIndex + 1}.{' '}
                  <EditableTitle
                    title={chapter.title}
                    onSave={(newTitle) =>
                      withErrorHandling(async () => {
                        await authFetch(`/chapters/${chapter.id}`, { method: 'PATCH', body: { title: newTitle } });
                        await refetch();
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void withErrorHandling(async () => {
                      if (!confirm('Delete this chapter and everything in it?')) return;
                      await authFetch(`/chapters/${chapter.id}`, { method: 'DELETE' });
                      await refetch();
                    })
                  }
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>

              {openChapters.has(chapter.id) ? (
                <div className="space-y-4 p-4">
                  {chapter.modules.map((mod, modIndex) => (
                    <div key={mod.id} className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <MoveButtons
                          disableUp={modIndex === 0}
                          disableDown={modIndex === chapter.modules.length - 1}
                          onMoveUp={() =>
                            void withErrorHandling(async () => {
                              await authFetch(`/modules/${mod.id}/move`, {
                                method: 'PATCH',
                                body: { direction: 'up' },
                              });
                              await refetch();
                            })
                          }
                          onMoveDown={() =>
                            void withErrorHandling(async () => {
                              await authFetch(`/modules/${mod.id}/move`, {
                                method: 'PATCH',
                                body: { direction: 'down' },
                              });
                              await refetch();
                            })
                          }
                        />
                        <p className="flex-1 text-sm font-semibold text-neutral-700">
                          <EditableTitle
                            title={mod.title}
                            onSave={(newTitle) =>
                              withErrorHandling(async () => {
                                await authFetch(`/modules/${mod.id}`, {
                                  method: 'PATCH',
                                  body: { title: newTitle },
                                });
                                await refetch();
                              })
                            }
                          />
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            void withErrorHandling(async () => {
                              if (!confirm('Delete this module and everything in it?')) return;
                              await authFetch(`/modules/${mod.id}`, { method: 'DELETE' });
                              await refetch();
                            })
                          }
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Lectures */}
                      <ul className="mb-2 space-y-1 pl-6">
                        {mod.lectures.map((lecture, lecIndex) => (
                          <li
                            key={lecture.id}
                            className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-sm"
                          >
                            <MoveButtons
                              disableUp={lecIndex === 0}
                              disableDown={lecIndex === mod.lectures.length - 1}
                              onMoveUp={() =>
                                void withErrorHandling(async () => {
                                  await authFetch(`/lectures/${lecture.id}/move`, {
                                    method: 'PATCH',
                                    body: { direction: 'up' },
                                  });
                                  await refetch();
                                })
                              }
                              onMoveDown={() =>
                                void withErrorHandling(async () => {
                                  await authFetch(`/lectures/${lecture.id}/move`, {
                                    method: 'PATCH',
                                    body: { direction: 'down' },
                                  });
                                  await refetch();
                                })
                              }
                            />
                            <span className="flex-1">
                              <EditableTitle
                                title={lecture.title}
                                onSave={(newTitle) =>
                                  withErrorHandling(async () => {
                                    await authFetch(`/lectures/${lecture.id}`, {
                                      method: 'PATCH',
                                      body: { title: newTitle },
                                    });
                                    await refetch();
                                  })
                                }
                              />
                            </span>
                            <select
                              value={lecture.status}
                              onChange={(e) =>
                                void withErrorHandling(async () => {
                                  await authFetch(`/lectures/${lecture.id}/status`, {
                                    method: 'PATCH',
                                    body: { status: e.target.value },
                                  });
                                  await refetch();
                                })
                              }
                              className="rounded border border-neutral-200 px-1.5 py-0.5 text-xs"
                            >
                              {LECTURE_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <Badge tone={statusTone(lecture.status)}>{lecture.status}</Badge>
                            <button
                              type="button"
                              onClick={() =>
                                void withErrorHandling(async () => {
                                  if (!confirm('Delete this lecture?')) return;
                                  await authFetch(`/lectures/${lecture.id}`, { method: 'DELETE' });
                                  await refetch();
                                })
                              }
                              className="text-xs text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </li>
                        ))}
                      </ul>
                      <LectureUploadForm
                        moduleId={mod.id}
                        authFetch={authFetch}
                        onDone={refetch}
                        onError={(msg) => setError(msg)}
                      />

                      {/* Notes */}
                      <ul className="mb-2 mt-3 space-y-1 pl-6">
                        {mod.notes.map((note) => (
                          <li key={note.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-sm">
                            <span className="flex-1">
                              <EditableTitle
                                title={note.title}
                                onSave={(newTitle) =>
                                  withErrorHandling(async () => {
                                    await authFetch(`/notes/${note.id}`, {
                                      method: 'PATCH',
                                      body: { title: newTitle },
                                    });
                                    await refetch();
                                  })
                                }
                              />
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void withErrorHandling(async () => {
                                  if (!confirm('Delete this note?')) return;
                                  await authFetch(`/notes/${note.id}`, { method: 'DELETE' });
                                  await refetch();
                                })
                              }
                              className="text-xs text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </li>
                        ))}
                      </ul>
                      <NoteUploadForm
                        moduleId={mod.id}
                        authFetch={authFetch}
                        onDone={refetch}
                        onError={(msg) => setError(msg)}
                      />

                      {/* Quizzes */}
                      <ul className="mb-2 mt-3 space-y-1 pl-6">
                        {mod.quizzes.map((quiz) => (
                          <li key={quiz.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-sm">
                            <span className="flex-1">
                              {quiz.title} · {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void withErrorHandling(async () => {
                                  const full = await authFetch<QuizDetail>(`/quizzes/${quiz.id}`);
                                  setQuizEditor({ moduleId: mod.id, quiz: full });
                                })
                              }
                              className="text-xs text-brand-600 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void withErrorHandling(async () => {
                                  if (!confirm('Delete this quiz?')) return;
                                  await authFetch(`/quizzes/${quiz.id}`, { method: 'DELETE' });
                                  await refetch();
                                })
                              }
                              className="text-xs text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </li>
                        ))}
                      </ul>

                      {quizEditor?.moduleId === mod.id ? (
                        <div className="pl-6">
                          <QuizBuilder
                            existing={quizEditor.quiz ?? undefined}
                            onCancel={() => setQuizEditor(null)}
                            onSubmit={async (input) => {
                              await withErrorHandling(async () => {
                                if (quizEditor.quiz) {
                                  await authFetch(`/quizzes/${quizEditor.quiz.id}`, {
                                    method: 'PATCH',
                                    body: input,
                                  });
                                } else {
                                  await authFetch(`/modules/${mod.id}/quizzes`, { method: 'POST', body: input });
                                }
                                setQuizEditor(null);
                                await refetch();
                              });
                            }}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setQuizEditor({ moduleId: mod.id, quiz: null })}
                          className="pl-6 text-xs text-brand-600 hover:underline"
                        >
                          + Add quiz
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="pl-2">
                    <InlineTextForm
                      placeholder="New module title…"
                      submitLabel="Add module"
                      onSubmit={(title) =>
                        withErrorHandling(async () => {
                          await authFetch(`/chapters/${chapter.id}/modules`, { method: 'POST', body: { title } });
                          await refetch();
                        })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-neutral-300 p-4">
        <InlineTextForm
          placeholder="New chapter title…"
          submitLabel="Add chapter"
          onSubmit={(title) =>
            withErrorHandling(async () => {
              await authFetch(`/courses/${courseId}/chapters`, { method: 'POST', body: { title } });
              await refetch();
            })
          }
        />
      </div>
    </div>
  );
}

/** Extracted because it needs its own file-input + local upload state,
 * separate from the parent's tree-wide state. */
function LectureUploadForm({
  moduleId,
  authFetch,
  onDone,
  onError,
}: {
  moduleId: string;
  authFetch: <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown }) => Promise<T>;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || !title.trim()) return;
    setIsUploading(true);
    try {
      const result = await authFetch<CreateLectureResult>(`/modules/${moduleId}/lectures`, {
        method: 'POST',
        body: { title: title.trim(), contentType: file.type },
      });
      await uploadFileToSignedUrl(result.uploadUrl, file, file.type);
      setTitle('');
      await onDone();
    } catch (err) {
      onError(err instanceof ApiClientError ? err.message : 'Video upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  return (
    <div className="flex items-center gap-2 pl-6">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New lecture title…"
        className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <label>
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={(e) => void handleFileSelected(e)}
          disabled={!title.trim() || isUploading}
          className="hidden"
          id={`lecture-upload-${moduleId}`}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!title.trim() || isUploading}
          onClick={() => document.getElementById(`lecture-upload-${moduleId}`)?.click()}
        >
          {isUploading ? 'Uploading…' : 'Add lecture (upload video)'}
        </Button>
      </label>
    </div>
  );
}

function NoteUploadForm({
  moduleId,
  authFetch,
  onDone,
  onError,
}: {
  moduleId: string;
  authFetch: <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown }) => Promise<T>;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || !title.trim()) return;
    setIsUploading(true);
    try {
      const result = await authFetch<CreateNoteResult>(`/modules/${moduleId}/notes`, {
        method: 'POST',
        body: { title: title.trim(), contentType: 'application/pdf' },
      });
      await uploadFileToSignedUrl(result.uploadUrl, file, 'application/pdf');
      setTitle('');
      await onDone();
    } catch (err) {
      onError(err instanceof ApiClientError ? err.message : 'Note upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  return (
    <div className="flex items-center gap-2 pl-6">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New note title…"
        className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => void handleFileSelected(e)}
          disabled={!title.trim() || isUploading}
          className="hidden"
          id={`note-upload-${moduleId}`}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!title.trim() || isUploading}
          onClick={() => document.getElementById(`note-upload-${moduleId}`)?.click()}
        >
          {isUploading ? 'Uploading…' : 'Add note (upload PDF)'}
        </Button>
      </label>
    </div>
  );
}
