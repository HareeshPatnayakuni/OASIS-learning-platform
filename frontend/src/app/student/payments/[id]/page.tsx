'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { ApiClientError } from '@/lib/api-client';
import type { PaymentDetail, PaymentStatus } from '@/types/api';

function statusTone(status: PaymentStatus): 'success' | 'neutral' | 'locked' {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED') return 'locked';
  return 'neutral';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-100 py-3 last:border-0">
      <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch<PaymentDetail>(`/payments/me/${id}`)
      .then((result) => {
        if (!cancelled) setPayment(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : "Couldn't load this payment right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, id]);

  if (error) return <ErrorState message={error} />;
  if (!payment) return <Spinner label="Loading payment…" />;

  return (
    <div>
      <Link href="/student/payments" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← Back to My Payments
      </Link>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Payment Details</h1>
      <p className="mb-6 text-sm text-neutral-500">Read-only record of this payment.</p>

      <dl className="max-w-xl rounded-xl border border-neutral-200 bg-white px-4">
        <Field label="Course" value={payment.course.title} />
        <Field
          label="Amount"
          value={`${payment.currency === 'INR' ? '₹' : payment.currency + ' '}${payment.amount.toLocaleString('en-IN')}`}
        />
        <Field label="Currency" value={payment.currency} />
        <Field label="Status" value={<Badge tone={statusTone(payment.status)}>{payment.status}</Badge>} />
        <Field label="Purchase Date" value={formatDate(payment.createdAt)} />
        <Field label="Payment ID" value={<code className="text-xs">{payment.id}</code>} />
        <Field label="Razorpay Order ID" value={<code className="text-xs">{payment.razorpayOrderId}</code>} />
        <Field
          label="Razorpay Payment ID"
          value={payment.razorpayPaymentId ? <code className="text-xs">{payment.razorpayPaymentId}</code> : '—'}
        />
      </dl>
    </div>
  );
}
