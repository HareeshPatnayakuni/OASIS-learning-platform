'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { ApiClientError } from '@/lib/api-client';
import { getDeviceId } from '@/lib/auth-storage';
import type { DeviceSummary } from '@/types/api';

function formatLastActive(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MyDevicesPage() {
  const { authFetch } = useAuth();
  const [devices, setDevices] = useState<DeviceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const currentDeviceId = getDeviceId();
    authFetch<DeviceSummary[]>(`/devices?currentDeviceId=${encodeURIComponent(currentDeviceId)}`)
      .then((result) => {
        if (!cancelled) setDevices(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your devices right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, retryToken]);

  async function handleRemove(device: DeviceSummary): Promise<void> {
    if (!confirm(`Remove "${device.deviceLabel ?? 'this device'}"? It will be signed out immediately.`)) return;
    setRemovingId(device.deviceId);
    try {
      const currentDeviceId = getDeviceId();
      await authFetch(
        `/devices/${encodeURIComponent(device.deviceId)}?currentDeviceId=${encodeURIComponent(currentDeviceId)}`,
        { method: 'DELETE' },
      );
      setDevices((prev) => prev?.filter((d) => d.deviceId !== device.deviceId) ?? null);
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Could not remove this device. Please try again.');
    } finally {
      setRemovingId(null);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => setRetryToken((t) => t + 1)} />;
  if (!devices) return <Spinner label="Loading your devices…" />;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">My Devices</h1>
      <p className="mb-6 text-sm text-neutral-500">
        OASIS allows up to 2 active devices at a time. Remove a device to free up a slot for a new one.
      </p>

      {devices.length === 0 ? (
        <EmptyState
          title="No active devices"
          description="This shouldn't normally happen while you're logged in — try refreshing."
        />
      ) : (
        <div className="space-y-3">
          {devices.map((device) => (
            <div
              key={device.deviceId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-neutral-900">{device.deviceLabel ?? 'Unknown device'}</p>
                  {device.isCurrentDevice ? <Badge tone="brand">This device</Badge> : null}
                </div>
                <p className="text-xs text-neutral-500">
                  {device.browser ?? 'Unknown browser'} · {device.operatingSystem ?? 'Unknown OS'} · Last active{' '}
                  {formatLastActive(device.lastActiveAt)}
                </p>
              </div>
              {!device.isCurrentDevice ? (
                <button
                  onClick={() => void handleRemove(device)}
                  disabled={removingId === device.deviceId}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  {removingId === device.deviceId ? 'Removing…' : 'Remove'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
