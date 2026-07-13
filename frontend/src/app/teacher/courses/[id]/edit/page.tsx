'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ApiClientError } from '@/lib/api-client';
import { uploadFileToSignedUrl } from '@/lib/upload';
import type { CatalogRef, ClassGrade, CourseStatus, CreateMediaResult, TeacherCourseSummary } from '@/types/api';

const inputClass =
  'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

function statusTone(status: CourseStatus): 'success' | 'neutral' | 'locked' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'locked';
  return 'neutral';
}

export default function EditCoursePage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useAuth();

  const [course, setCourse] = useState<TeacherCourseSummary | null>(null);
  const [boards, setBoards] = useState<CatalogRef[]>([]);
  const [classGrades, setClassGrades] = useState<ClassGrade[]>([]);
  const [subjects, setSubjects] = useState<CatalogRef[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [boardId, setBoardId] = useState('');
  const [classGradeId, setClassGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [price, setPrice] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState<CourseStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authFetch<TeacherCourseSummary>(`/courses/mine/${id}`),
      authFetch<CatalogRef[]>('/boards'),
      authFetch<ClassGrade[]>('/class-grades'),
      authFetch<CatalogRef[]>('/subjects'),
    ])
      .then(([courseResult, boardsResult, classGradesResult, subjectsResult]) => {
        if (cancelled) return;
        setCourse(courseResult);
        setBoards(boardsResult);
        setClassGrades(classGradesResult);
        setSubjects(subjectsResult);
        setTitle(courseResult.title);
        setDescription(courseResult.description);
        setBoardId(courseResult.board.id);
        setClassGradeId(courseResult.classGrade.id);
        setSubjectId(courseResult.subject.id);
        setPrice(String(courseResult.price));
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load this course right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [id, authFetch]);

  async function handleSave(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaveError(null);
    setSaveMessage(null);
    setIsSaving(true);
    try {
      const updated = await authFetch<TeacherCourseSummary>(`/courses/${id}`, {
        method: 'PATCH',
        body: { title, description, boardId, classGradeId, subjectId, price: Number(price) },
      });
      setCourse(updated);
      setSaveMessage('Course updated.');
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleThumbnailChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaveError(null);
    setIsUploadingThumbnail(true);
    try {
      const media = await authFetch<CreateMediaResult>('/media', {
        method: 'POST',
        body: { purpose: 'COURSE_THUMBNAIL', contentType: file.type },
      });
      await uploadFileToSignedUrl(media.uploadUrl, file, file.type);
      const updated = await authFetch<TeacherCourseSummary>(`/courses/${id}`, {
        method: 'PATCH',
        body: { thumbnailId: media.id },
      });
      setCourse(updated);
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : 'Thumbnail upload failed. Please try again.');
    } finally {
      setIsUploadingThumbnail(false);
      event.target.value = '';
    }
  }

  async function handleStatusChange(status: CourseStatus): Promise<void> {
    setSaveError(null);
    setStatusActionLoading(status);
    try {
      const updated = await authFetch<TeacherCourseSummary>(`/courses/${id}/status`, {
        method: 'PATCH',
        body: { status },
      });
      setCourse(updated);
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : 'Could not update status. Please try again.');
    } finally {
      setStatusActionLoading(null);
    }
  }

  if (loadError) return <ErrorState message={loadError} />;
  if (!course) return <Spinner label="Loading course…" />;

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-900">{course.title}</h1>
            <Badge tone={statusTone(course.status)}>{course.status}</Badge>
          </div>
          <Link href={`/teacher/courses/${id}/content`} className="text-sm text-brand-600 hover:underline">
            Manage chapters &amp; lectures →
          </Link>
        </div>
        <div className="flex gap-2">
          {course.status !== 'DRAFT' ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={statusActionLoading !== null}
              onClick={() => void handleStatusChange('DRAFT')}
            >
              {statusActionLoading === 'DRAFT' ? 'Saving…' : 'Save as Draft'}
            </Button>
          ) : null}
          {course.status !== 'PUBLISHED' ? (
            <Button
              variant="primary"
              size="sm"
              disabled={statusActionLoading !== null}
              onClick={() => void handleStatusChange('PUBLISHED')}
            >
              {statusActionLoading === 'PUBLISHED' ? 'Publishing…' : 'Publish'}
            </Button>
          ) : null}
          {course.status !== 'ARCHIVED' ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={statusActionLoading !== null}
              onClick={() => void handleStatusChange('ARCHIVED')}
            >
              {statusActionLoading === 'ARCHIVED' ? 'Archiving…' : 'Archive'}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium text-neutral-700">Thumbnail</label>
        <div className="flex items-center gap-4">
          <div className="aspect-video w-40 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-brand-50">
            {course.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void handleThumbnailChange(e)}
              disabled={isUploadingThumbnail}
              className="hidden"
              id="thumbnail-input"
            />
            <span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isUploadingThumbnail}
                onClick={() => document.getElementById('thumbnail-input')?.click()}
              >
                {isUploadingThumbnail ? 'Uploading…' : 'Upload image'}
              </Button>
            </span>
          </label>
        </div>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Title</label>
          <input required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Description</label>
          <textarea
            required
            minLength={10}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Board</label>
            <select required value={boardId} onChange={(e) => setBoardId(e.target.value)} className={inputClass}>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Class</label>
            <select
              required
              value={classGradeId}
              onChange={(e) => setClassGradeId(e.target.value)}
              className={inputClass}
            >
              {classGrades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Subject</label>
            <select required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputClass}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Price (₹)</label>
          <input
            required
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass}
          />
        </div>

        {saveError ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </p>
        ) : null}
        {saveMessage ? (
          <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-success-600">
            {saveMessage}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
