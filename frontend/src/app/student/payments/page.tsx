'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import type { PaymentListItem, PaymentStatus } from '@/types/api';

function statusTone(status: PaymentStatus): 'success' | 'neutral' | 'locked' {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED') return 'locked';
  return 'neutral'; // PENDING, REFUNDED
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyPaymentsPage() {
  const { authFetchPaginated } = useAuth();
  const [payments, setPayments] = useState<PaymentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetchPaginated<PaymentListItem>('/payments/me?limit=50')
      .then((result) => {
        if (!cancelled) setPayments(result.data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your payments right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [authFetchPaginated]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">My Payments</h1>
      <p className="mb-6 text-sm text-neutral-500">Your payment history, newest first.</p>

      {error ? (
        <ErrorState message={error} />
      ) : !payments ? (
        <Spinner label="Loading your payments…" />
      ) : payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          description="Once you purchase a course, it'll show up here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Razorpay Payment ID</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/student/payments/${payment.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {payment.course.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {payment.currency === 'INR' ? '₹' : `${payment.currency} `}
                    {payment.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{formatDate(payment.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(payment.status)}>{payment.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{payment.razorpayPaymentId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
