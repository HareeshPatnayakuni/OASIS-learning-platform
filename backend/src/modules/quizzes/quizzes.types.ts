/**
 * Teacher-authoring for Quiz -> Question -> QuestionOption. Per Module 1's
 * schema rationale (docs/03-database-design.md §2.6), Question/
 * QuestionOption are pure structural children of Quiz with no reordering
 * or independent lifecycle of their own — "editing" a quiz's questions is
 * a wholesale replace (delete all existing questions, which cascades to
 * their options, then create the new set), not per-question PATCH
 * endpoints. This keeps the API surface small and matches how a teacher
 * actually edits a quiz in practice (via one form submission for the
 * whole thing), rather than adding a second reordering feature Module 3B
 * didn't ask for on top of an entity the brief doesn't mention reordering
 * for at all.
 */

export interface QuestionOptionInput {
  text: string;
  isCorrect: boolean;
}

export interface QuestionInput {
  text: string;
  options: QuestionOptionInput[];
}

export interface CreateQuizInput {
  title: string;
  passPercent?: number;
  questions: QuestionInput[];
}

export interface UpdateQuizInput {
  title?: string;
  passPercent?: number;
  /** If provided, replaces the ENTIRE question set (see module doc above). */
  questions?: QuestionInput[];
}

export interface QuestionOptionRecord {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionRecord {
  id: string;
  text: string;
  order: number;
  options: QuestionOptionRecord[];
}

export interface QuizRecord {
  id: string;
  moduleId: string;
  title: string;
  passPercent: number;
  questions: QuestionRecord[];
}

export interface QuizRepository {
  createQuiz(moduleId: string, input: CreateQuizInput): Promise<QuizRecord>;
  findQuizById(id: string): Promise<QuizRecord | null>;
  updateQuiz(id: string, input: UpdateQuizInput): Promise<QuizRecord>;
  softDeleteQuiz(id: string): Promise<void>;
}
