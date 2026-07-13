'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import type { DashboardStats } from '@/types/api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminDashboardPage() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch<DashboardStats>('/admin/dashboard')
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the dashboard right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  if (error) return <ErrorState message={error} />;
  if (!stats) return <Spinner label="Loading dashboard…" />;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Admin Dashboard</h1>
        <p className="text-sm text-neutral-500">Platform overview at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Students" value={stats.totalStudents} />
        <StatCard label="Total Teachers" value={stats.totalTeachers} />
        <StatCard label="Total Courses" value={stats.totalCourses} />
        <StatCard label="Total Enrollments" value={stats.totalEnrollments} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-neutral-500 uppercase">
          Recent Registrations
        </h2>
        {stats.recentRegistrations.length === 0 ? (
          <EmptyState title="No registrations yet" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {stats.recentRegistrations.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-2.5 font-medium text-neutral-900">{user.fullName}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{user.email}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={user.role === 'TEACHER' ? 'brand' : 'neutral'}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-neutral-500 uppercase">
          Recent Announcements
        </h2>
        {stats.recentAnnouncements.length === 0 ? (
          <EmptyState title="No announcements yet" />
        ) : (
          <ul className="space-y-2">
            {stats.recentAnnouncements.map((announcement) => (
              <li key={announcement.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-medium text-neutral-900">{announcement.title}</p>
                  <span className="shrink-0 text-xs text-neutral-400">{formatDate(announcement.createdAt)}</span>
                </div>
                <p className="text-sm text-neutral-600">{announcement.body}</p>
                <p className="mt-2 text-xs text-neutral-400">
                  {announcement.courseId ? 'Course announcement' : 'Platform-wide'} · {announcement.authorName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
