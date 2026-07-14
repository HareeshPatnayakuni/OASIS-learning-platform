'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { apiRequest, ApiClientError } from '@/lib/api-client';
import type { CatalogRef, ClassGrade, UserProfile } from '@/types/api';

export default function ProfilePage() {
  const { authFetch } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [boards, setBoards] = useState<CatalogRef[]>([]);
  const [classGrades, setClassGrades] = useState<ClassGrade[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [classGradeId, setClassGradeId] = useState('');
  const [boardId, setBoardId] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authFetch<UserProfile>('/users/me'),
      apiRequest<CatalogRef[]>('/boards'),
      apiRequest<ClassGrade[]>('/class-grades'),
    ])
      .then(([profileResult, boardsResult, classGradesResult]) => {
        if (cancelled) return;
        setProfile(profileResult);
        setBoards(boardsResult);
        setClassGrades(classGradesResult);
        setFullName(profileResult.fullName);
        setPhone(profileResult.phone ?? '');
        setClassGradeId(profileResult.classGrade?.id ?? '');
        setBoardId(profileResult.board?.id ?? '');
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load your profile right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function handleSave(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaveError(null);
    setSaveMessage(null);
    setIsSaving(true);
    try {
      const updated = await authFetch<UserProfile>('/users/me', {
        method: 'PATCH',
        body: {
          fullName,
          phone: phone || null,
          classGradeId: classGradeId || null,
          boardId: boardId || null,
        },
      });
      setProfile(updated);
      setSaveMessage('Profile updated.');
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} />;
  if (!profile) return <Spinner label="Loading your profile…" />;

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Profile</h1>
      <p className="mb-6 text-sm text-neutral-500">{profile.email}</p>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-neutral-700">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            required
            minLength={2}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-neutral-700">
            Phone <span className="text-neutral-400">(optional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="board" className="mb-1 block text-sm font-medium text-neutral-700">
              Board
            </label>
            <select
              id="board"
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">—</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="classGrade" className="mb-1 block text-sm font-medium text-neutral-700">
              Class
            </label>
            <select
              id="classGrade"
              value={classGradeId}
              onChange={(e) => setClassGradeId(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">—</option>
              {classGrades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {saveError ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </p>
        ) : null}
        {saveMessage ? (
          <p role="status" className="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-600">
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
