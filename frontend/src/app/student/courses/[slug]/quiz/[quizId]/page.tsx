'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ApiClientError } from '@/lib/api-client';
import type { QuizAttemptResult, QuizAttemptSummary, QuizForAttempt } from '@/types/api';

type View =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'previous-result'; attempt: QuizAttemptSummary }
  | { status: 'taking'; quiz: QuizForAttempt }
  | { status: 'fresh-result'; result: QuizAttemptResult };

export default function TakeQuizPage() {
  const { slug, quizId } = useParams<{ slug: string; quizId: string }>();
  const { authFetch } = useAuth();
  const [view, setView] = useState<View>({ status: 'loading' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  // On first load, check for a previous attempt — if one exists, show
  // that result rather than the quiz form (multiple attempts are still
  // allowed; "Retake Quiz" below fetches the quiz and switches views).
  useEffect(() => {
    let cancelled = false;
    authFetch<QuizAttemptSummary | null>(`/quizzes/${quizId}/my-attempt`)
      .then((previous) => {
        if (cancelled) return;
        if (previous) {
          setView({ status: 'previous-result', attempt: previous });
        } else {
          void loadQuiz();
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setView({
            status: 'error',
            message: err instanceof ApiClientError ? err.message : "Couldn't load this quiz right now.",
          });
        }
      });

    async function loadQuiz(): Promise<void> {
      try {
        const quiz = await authFetch<QuizForAttempt>(`/quizzes/${quizId}/attempt`);
        if (!cancelled) setView({ status: 'taking', quiz });
      } catch (err) {
        if (!cancelled) {
          setView({
            status: 'error',
            message: err instanceof ApiClientError ? err.message : "Couldn't load this quiz right now.",
          });
        }
      }
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, retryToken]);

  async function handleRetake(): Promise<void> {
    setView({ status: 'loading' });
    try {
      const quiz = await authFetch<QuizForAttempt>(`/quizzes/${quizId}/attempt`);
      setAnswers({});
      setView({ status: 'taking', quiz });
    } catch (err) {
      setView({
        status: 'error',
        message: err instanceof ApiClientError ? err.message : "Couldn't load this quiz right now.",
      });
    }
  }

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    try {
      const result = await authFetch<QuizAttemptResult>(`/quizzes/${quizId}/attempt`, {
        method: 'POST',
        body: { answers: Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })) },
      });
      setView({ status: 'fresh-result', result });
    } catch (err) {
      setView({
        status: 'error',
        message: err instanceof ApiClientError ? err.message : 'Could not submit your answers. Please try again.',
      });
    }
    setSubmitting(false);
  }

  if (view.status === 'error') {
    return <ErrorState message={view.message} onRetry={() => setRetryToken((t) => t + 1)} />;
  }
  if (view.status === 'loading') {
    return <Spinner label="Loading quiz…" />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/student/courses/${slug}/learn`}
        className="mb-4 inline-block text-sm text-brand-600 hover:underline"
      >
        ← Back to course
      </Link>

      {view.status === 'previous-result' ? (
        <ResultSummaryCard
          score={view.attempt.score}
          totalMarks={view.attempt.totalMarks}
          heading="Your previous result"
          onRetake={() => void handleRetake()}
        />
      ) : view.status === 'fresh-result' ? (
        <>
          <ResultSummaryCard
            score={view.result.score}
            totalMarks={view.result.totalMarks}
            passed={view.result.passed}
            heading="Quiz submitted"
            onRetake={() => void handleRetake()}
          />
          <div className="mt-6 space-y-3">
            {view.result.questionResults.map((qr, index) => (
              <div key={qr.questionId} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-900">Question {index + 1}</p>
                  <Badge tone={qr.isCorrect ? 'success' : 'locked'}>{qr.isCorrect ? 'Correct' : 'Incorrect'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <QuizForm quiz={view.quiz} answers={answers} setAnswers={setAnswers} submitting={submitting} onSubmit={() => void handleSubmit()} />
      )}
    </div>
  );
}

function ResultSummaryCard({
  score,
  totalMarks,
  passed,
  heading,
  onRetake,
}: {
  score: number;
  totalMarks: number;
  passed?: boolean;
  heading: string;
  onRetake: () => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
      <h1 className="mb-2 text-xl font-semibold text-neutral-900">{heading}</h1>
      <p className="mb-1 text-4xl font-bold text-brand-600">
        {score} / {totalMarks}
      </p>
      <p className="mb-4 text-sm text-neutral-500">
        {score} correct answer{score === 1 ? '' : 's'} out of {totalMarks} question{totalMarks === 1 ? '' : 's'}
      </p>
      {passed !== undefined ? (
        <Badge tone={passed ? 'success' : 'locked'}>{passed ? 'Passed' : 'Not passed'}</Badge>
      ) : null}
      <div className="mt-4">
        <Button variant="secondary" size="sm" onClick={onRetake}>
          Retake Quiz
        </Button>
      </div>
    </div>
  );
}

function QuizForm({
  quiz,
  answers,
  setAnswers,
  submitting,
  onSubmit,
}: {
  quiz: QuizForAttempt;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const answeredCount = Object.keys(answers).length;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">{quiz.title}</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'} · Pass mark: {quiz.passPercent}%
      </p>

      <div className="space-y-5">
        {quiz.questions.map((question, index) => (
          <fieldset key={question.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <legend className="mb-3 px-1 text-sm font-medium text-neutral-900">
              {index + 1}. {question.text}
            </legend>
            <div className="space-y-2">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option.id}
                    checked={answers[question.id] === option.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                    className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                  />
                  {option.text}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="primary" size="lg" disabled={submitting} onClick={onSubmit}>
          {submitting ? 'Submitting…' : 'Submit Quiz'}
        </Button>
        <p className="text-xs text-neutral-500">
          {answeredCount} of {quiz.questions.length} answered
        </p>
      </div>
    </div>
  );
}
