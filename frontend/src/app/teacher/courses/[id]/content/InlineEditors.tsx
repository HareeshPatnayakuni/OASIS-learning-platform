'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function InlineTextForm({
  placeholder,
  submitLabel,
  onSubmit,
  autoFocus = false,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (value: string) => Promise<void>;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setValue('');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <Button type="submit" variant="secondary" size="sm" disabled={isSubmitting || !value.trim()}>
        {isSubmitting ? '…' : submitLabel}
      </Button>
    </form>
  );
}

export function EditableTitle({
  title,
  onSave,
}: {
  title: string;
  onSave: (newTitle: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [isSaving, setIsSaving] = useState(false);

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setValue(title);
          setIsEditing(true);
        }}
        className="rounded px-1 text-left hover:bg-neutral-100"
        title="Click to edit"
      >
        {title}
      </button>
    );
  }

  async function handleSave(): Promise<void> {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void handleSave()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void handleSave();
        if (e.key === 'Escape') setIsEditing(false);
      }}
      disabled={isSaving}
      autoFocus
      className="rounded border border-brand-300 px-1 py-0.5 text-sm focus:outline-none"
    />
  );
}
