/**
 * Module 6 — Student Quiz Attempt Flow. Deliberately separate from
 * quizzes.types.ts (teacher authoring) rather than extending it, the
 * same way courses.repository.ts (student reads) and
 * courses.teacher.repository.ts (teacher writes) are two files for one
 * entity, not one — but the actual quiz-structure *read* (questions +
 * options) reuses `QuizRepository.findQuizById` directly rather than
 * duplicating that query; this file only adds what's genuinely new:
 * stripping `isCorrect` before it reaches a student, and everything
 * about attempts themselves.
 *
 * Attempt policy (see docs/16-module-6-notes.md for the full reasoning):
 * `QuizAttempt` has `@@index([quizId, studentId])` but no unique
 * constraint — the schema was never built to allow only one attempt.
 * Multiple attempts are allowed; each submission creates a new,
 * immutable `QuizAttempt` row; "my attempt" returns the most recent one.
 * This is the simplest behavior consistent with the existing schema,
 * chosen deliberately rather than inventing a single-attempt or
 * best-score policy the schema was never designed to enforce.
 */

/** No `isCorrect` — this is what a student sees *before* submitting. */
export interface OptionForAttempt {
  id: string;
  text: string;
}

export interface QuestionForAttempt {
  id: string;
  text: string;
  order: number;
  options: OptionForAttempt[];
}

export interface QuizForAttempt {
  id: string;
  title: string;
  passPercent: number;
  questions: QuestionForAttempt[];
}

export interface SubmittedAnswer {
  questionId: string;
  optionId: string;
}

export interface SubmitAnswersInput {
  answers: SubmittedAnswer[];
}

/** Per-question correctness — computable only *at submission time*,
 * from the real, `isCorrect`-bearing quiz structure already in memory
 * for scoring. Never persisted (`QuizAttempt` only stores the
 * aggregate `score`/`totalMarks`), so this can only ever be part of a
 * fresh submission's response, not a later "my attempt" fetch — see
 * `QuizAttemptSummary` below, which is what a *previous* attempt can
 * actually show. */
export interface QuestionResult {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  isCorrect: boolean;
}

export interface QuizAttemptResult {
  id: string;
  score: number;
  totalMarks: number;
  passPercent: number;
  passed: boolean;
  attemptedAt: Date;
  questionResults: QuestionResult[];
}

/** What a *previous* attempt can show, fetched later — no
 * `questionResults`, since that was never persisted. */
export interface QuizAttemptSummary {
  id: string;
  score: number;
  totalMarks: number;
  attemptedAt: Date;
}

export interface QuizAttemptRecord {
  id: string;
  quizId: string;
  studentId: string;
  score: number;
  totalMarks: number;
  attemptedAt: Date;
}

export interface QuizAttemptRepository {
  /** Null if the quiz doesn't exist, is soft-deleted, or its parent
   * course isn't currently PUBLISHED/is soft-deleted — same 404 either
   * way at the service layer, so a not-yet-published or since-archived
   * course's quiz never leaks its existence. */
  findQuizForAccess(quizId: string): Promise<{ courseId: string } | null>;
  createAttempt(quizId: string, studentId: string, score: number, totalMarks: number): Promise<QuizAttemptRecord>;
  /** Most recent attempt only, per the attempt policy above. */
  findLatestAttempt(quizId: string, studentId: string): Promise<QuizAttemptRecord | null>;
}
