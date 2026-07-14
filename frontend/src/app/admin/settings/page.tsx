'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { ApiClientError } from '@/lib/api-client';
import { uploadFileToSignedUrl } from '@/lib/upload';
import type { CreateMediaResult, PlatformSettings } from '@/types/api';

const inputClass =
  'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

export default function AdminSettingsPage() {
  const { authFetch } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [academyName, setAcademyName] = useState('');
  const [academyFullName, setAcademyFullName] = useState('');
  const [tagline, setTagline] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [facebook, setFacebook] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<'logo' | 'favicon' | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch<PlatformSettings>('/admin/settings')
      .then((result) => {
        if (cancelled) return;
        setSettings(result);
        setAcademyName(result.academyName);
        setAcademyFullName(result.academyFullName ?? '');
        setTagline(result.tagline ?? '');
        setContactEmail(result.contactEmail);
        setContactPhone(result.contactPhone ?? '');
        setAddress(result.address ?? '');
        setInstagram(result.socialLinks?.instagram ?? '');
        setYoutube(result.socialLinks?.youtube ?? '');
        setFacebook(result.socialLinks?.facebook ?? '');
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load platform settings right now.");
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
      const socialLinks: Record<string, string> = {};
      if (instagram) socialLinks.instagram = instagram;
      if (youtube) socialLinks.youtube = youtube;
      if (facebook) socialLinks.facebook = facebook;

      const updated = await authFetch<PlatformSettings>('/admin/settings', {
        method: 'PATCH',
        body: {
          academyName,
          academyFullName: academyFullName || null,
          tagline: tagline || null,
          contactEmail,
          contactPhone: contactPhone || null,
          address: address || null,
          socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
        },
      });
      setSettings(updated);
      setSaveMessage('Settings updated.');
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImageUpload(kind: 'logo' | 'favicon', file: File): Promise<void> {
    setSaveError(null);
    setUploadingImage(kind);
    try {
      const media = await authFetch<CreateMediaResult>('/media', {
        method: 'POST',
        body: { purpose: kind === 'logo' ? 'ACADEMY_LOGO' : 'GENERIC', contentType: file.type },
      });
      await uploadFileToSignedUrl(media.uploadUrl, file, file.type);
      const updated = await authFetch<PlatformSettings>('/admin/settings', {
        method: 'PATCH',
        body: kind === 'logo' ? { logoId: media.id } : { faviconId: media.id },
      });
      setSettings(updated);
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : 'Image upload failed. Please try again.');
    } finally {
      setUploadingImage(null);
    }
  }

  if (loadError) return <ErrorState message={loadError} />;
  if (!settings) return <Spinner label="Loading settings…" />;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Platform Settings</h1>
      <p className="mb-6 text-sm text-neutral-500">Branding and contact details shown across the site.</p>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <ImageUploadField
          label="Website Logo"
          currentUrl={settings.logoUrl}
          isUploading={uploadingImage === 'logo'}
          onSelect={(file) => void handleImageUpload('logo', file)}
        />
        <ImageUploadField
          label="Website Favicon"
          currentUrl={settings.faviconUrl}
          isUploading={uploadingImage === 'favicon'}
          onSelect={(file) => void handleImageUpload('favicon', file)}
        />
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Academy Name">
            <input required value={academyName} onChange={(e) => setAcademyName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Academy Full Name">
            <input value={academyFullName} onChange={(e) => setAcademyFullName(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="Tagline">
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact Email">
            <input
              required
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Phone Number">
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="Address">
          <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">Social Media Links</p>
          <div className="grid grid-cols-3 gap-3">
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="Instagram URL"
              className={inputClass}
            />
            <input
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="YouTube URL"
              className={inputClass}
            />
            <input
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="Facebook URL"
              className={inputClass}
            />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-700">{label}</label>
      {children}
    </div>
  );
}

function ImageUploadField({
  label,
  currentUrl,
  isUploading,
  onSelect,
}: {
  label: string;
  currentUrl: string | null;
  isUploading: boolean;
  onSelect: (file: File) => void;
}) {
  const inputId = `upload-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-700">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-neutral-400">None</span>
          )}
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelect(file);
            e.target.value = '';
          }}
          disabled={isUploading}
          className="hidden"
          id={inputId}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isUploading}
          onClick={() => document.getElementById(inputId)?.click()}
        >
          {isUploading ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </div>
  );
}
