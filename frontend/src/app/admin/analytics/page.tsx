'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/States';
import type { AnalyticsStats } from '@/types/api';

export default function AdminAnalyticsPage() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch<AnalyticsStats>('/admin/analytics')
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load analytics right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  if (error) return <ErrorState message={error} />;
  if (!stats) return <Spinner label="Loading analytics…" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Analytics</h1>
        <p className="text-sm text-neutral-500">
          Basic platform counts — no charts or trend reports in this version.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Students" value={stats.totalStudents} />
        <StatCard label="Total Teachers" value={stats.totalTeachers} />
        <StatCard label="Total Courses" value={stats.totalCourses} />
        <StatCard label="Published Courses" value={stats.publishedCourses} />
        <StatCard label="Total Enrollments" value={stats.totalEnrollments} />
        <StatCard
          label="Active Users"
          value={stats.activeUsers}
          hint="Users with a currently valid login session"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-400">{hint}</p> : null}
    </div>
  );
}
