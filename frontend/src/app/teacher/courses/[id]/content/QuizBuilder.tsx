'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { QuestionDraft, QuizDetail } from '@/types/api';

function emptyQuestion(): QuestionDraft {
  return { text: '', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] };
}

export function QuizBuilder({
  existing,
  onSubmit,
  onCancel,
}: {
  existing?: QuizDetail;
  onSubmit: (input: { title: string; passPercent: number; questions: QuestionDraft[] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [passPercent, setPassPercent] = useState(existing?.passPercent ?? 40);
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    existing
      ? existing.questions.map((q) => ({
          text: q.text,
          options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
        }))
      : [emptyQuestion()],
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateQuestionText(index: number, text: string): void {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, text } : q)));
  }

  function updateOptionText(qIndex: number, oIndex: number, text: string): void {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? { ...o, text } : o)) } : q,
      ),
    );
  }

  function setCorrectOption(qIndex: number, oIndex: number): void {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => ({ ...o, isCorrect: j === oIndex })) }
          : q,
      ),
    );
  }

  function addOption(qIndex: number): void {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, { text: '', isCorrect: false }] } : q)),
    );
  }

  function removeOption(qIndex: number, oIndex: number): void {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: q.options.filter((_, j) => j !== oIndex) } : q)),
    );
  }

  function addQuestion(): void {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(index: number): void {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (questions.some((q) => !q.text.trim() || q.options.some((o) => !o.text.trim()))) {
      setError('Every question and option needs text.');
      return;
    }
    if (questions.some((q) => q.options.length < 2)) {
      setError('Every question needs at least 2 options.');
      return;
    }
    if (questions.some((q) => !q.options.some((o) => o.isCorrect))) {
      setError('Every question needs a correct answer selected.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), passPercent, questions });
    } catch {
      setError('Could not save the quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-4 rounded-lg border border-brand-200 bg-brand-50/40 p-4"
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Quiz title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Pass %</label>
          <input
            type="number"
            min={0}
            max={100}
            value={passPercent}
            onChange={(e) => setPassPercent(Number(e.target.value))}
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question, qIndex) => (
          <div key={qIndex} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-400">Q{qIndex + 1}</span>
              <input
                value={question.text}
                onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                placeholder="Question text"
                className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {questions.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div className="space-y-1.5 pl-6">
              {question.options.map((option, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qIndex}`}
                    checked={option.isCorrect}
                    onChange={() => setCorrectOption(qIndex, oIndex)}
                    aria-label={`Mark option ${oIndex + 1} as correct`}
                  />
                  <input
                    value={option.text}
                    onChange={(e) => updateOptionText(qIndex, oIndex, e.target.value)}
                    placeholder={`Option ${oIndex + 1}`}
                    className="flex-1 rounded-lg border border-neutral-200 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  {question.options.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => removeOption(qIndex, oIndex)}
                      className="text-xs text-neutral-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOption(qIndex)}
                className="text-xs text-brand-600 hover:underline"
              >
                + Add option
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addQuestion} className="text-sm text-brand-600 hover:underline">
        + Add question
      </button>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : existing ? 'Save quiz' : 'Create quiz'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
