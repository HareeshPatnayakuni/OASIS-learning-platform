'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { apiRequest, ApiClientError } from '@/lib/api-client';
import type { CatalogRef, ClassGrade, TeacherCourseSummary } from '@/types/api';

export default function CreateCoursePage() {
  const { authFetch } = useAuth();
  const router = useRouter();

  const [boards, setBoards] = useState<CatalogRef[]>([]);
  const [classGrades, setClassGrades] = useState<ClassGrade[]>([]);
  const [subjects, setSubjects] = useState<CatalogRef[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [boardId, setBoardId] = useState('');
  const [classGradeId, setClassGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest<CatalogRef[]>('/boards'),
      apiRequest<ClassGrade[]>('/class-grades'),
      apiRequest<CatalogRef[]>('/subjects'),
    ])
      .then(([b, c, s]) => {
        setBoards(b);
        setClassGrades(c);
        setSubjects(s);
      })
      .catch(() => setError('Could not load catalog options — try refreshing the page.'));
  }, []);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const course = await authFetch<TeacherCourseSummary>('/courses', {
        method: 'POST',
        body: { title, description, boardId, classGradeId, subjectId, price: Number(price) },
      });
      router.push(`/teacher/courses/${course.id}/content`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Create a course</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Starts as a Draft — you can add chapters and lectures next, then publish when ready.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Field label="Title">
          <input
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Description">
          <textarea
            required
            minLength={10}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Board">
            <select required value={boardId} onChange={(e) => setBoardId(e.target.value)} className={inputClass}>
              <option value="" disabled>
                Select…
              </option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select
              required
              value={classGradeId}
              onChange={(e) => setClassGradeId(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select…
              </option>
              {classGrades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <select
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select…
              </option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Price (₹)">
          <input
            required
            type="number"
            min={0}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass}
          />
        </Field>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Creating…' : 'Create course'}
        </Button>
      </form>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-700">{label}</label>
      {children}
    </div>
  );
}
