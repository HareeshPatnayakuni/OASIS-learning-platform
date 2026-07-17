'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import type { AdminPaymentListItem, PaymentStatus } from '@/types/api';

const inputClass =
  'rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

function statusTone(status: PaymentStatus): 'success' | 'neutral' | 'locked' {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED') return 'locked';
  return 'neutral'; // PENDING, REFUNDED
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminPaymentsPage() {
  const { authFetchPaginated } = useAuth();
  const [payments, setPayments] = useState<AdminPaymentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studentInput, setStudentInput] = useState('');
  const [courseInput, setCourseInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function refetch(overrides?: { student?: string; course?: string; status?: string }): Promise<void> {
    try {
      const student = overrides?.student !== undefined ? overrides.student : studentInput;
      const course = overrides?.course !== undefined ? overrides.course : courseInput;
      const status = overrides?.status !== undefined ? overrides.status : statusFilter;
      const params = new URLSearchParams();
      if (student) params.set('student', student);
      if (course) params.set('course', course);
      if (status) params.set('status', status);
      params.set('limit', '50');
      const result = await authFetchPaginated<AdminPaymentListItem>(`/admin/payments?${params.toString()}`);
      setPayments(result.data);
    } catch {
      setError("Couldn't load payments right now.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    authFetchPaginated<AdminPaymentListItem>('/admin/payments?limit=50')
      .then((result) => {
        if (!cancelled) setPayments(result.data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load payments right now.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStudentSubmit(event: FormEvent): void {
    event.preventDefault();
    void refetch({ student: studentInput });
  }

  function handleCourseSubmit(event: FormEvent): void {
    event.preventDefault();
    void refetch({ course: courseInput });
  }

  function handleStatusChange(value: string): void {
    setStatusFilter(value);
    void refetch({ status: value });
  }

  if (error) return <ErrorState message={error} onRetry={() => setError(null)} />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Payment Management</h1>
        <p className="text-sm text-neutral-500">
          Read-only oversight of every payment — newest first. No editing, deleting, or refunds here.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <form onSubmit={handleStudentSubmit} className="max-w-xs flex-1">
          <input
            value={studentInput}
            onChange={(e) => setStudentInput(e.target.value)}
            placeholder="Search by student name…"
            className={`w-full ${inputClass}`}
          />
        </form>
        <form onSubmit={handleCourseSubmit} className="max-w-xs flex-1">
          <input
            value={courseInput}
            onChange={(e) => setCourseInput(e.target.value)}
            placeholder="Search by course…"
            className={`w-full ${inputClass}`}
          />
        </form>
        <select value={statusFilter} onChange={(e) => handleStatusChange(e.target.value)} className={inputClass}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      {!payments ? (
        <Spinner label="Loading payments…" />
      ) : payments.length === 0 ? (
        <EmptyState title="No payments found" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Purchase Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3 text-neutral-600">
                    {payment.student.fullName}
                    <br />
                    <span className="text-xs text-neutral-400">{payment.student.email}</span>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate font-medium text-neutral-900">{payment.course.title}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {payment.currency === 'INR' ? '₹' : `${payment.currency} `}
                    {payment.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(payment.status)}>{payment.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{formatDate(payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
