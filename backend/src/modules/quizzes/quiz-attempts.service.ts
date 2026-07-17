import { ApiError } from '../../utils/ApiError';
import type { ContentRepository } from '../content/content.types';
import type { QuizRepository } from './quizzes.types';
import type {
  QuestionResult,
  QuizAttemptRepository,
  QuizAttemptResult,
  QuizAttemptSummary,
  QuizForAttempt,
  SubmitAnswersInput,
} from './quiz-attempts.types';

/**
 * Every method here follows the same shape as ContentService (Module 3A/
 * 4A): resolve the quiz's parent course, check enrollment fresh, THEN
 * act — never cached, never inferred from a prior request. Reuses
 * `QuizRepository.findQuizById` (the teacher module's existing read
 * path) for the actual quiz structure rather than duplicating that
 * query, and `ContentRepository.isStudentEnrolled` (already the
 * established enrollment check for student content access) rather than
 * a new one.
 */
export class QuizAttemptService {
  constructor(
    private readonly quizRepo: QuizRepository,
    private readonly attemptRepo: QuizAttemptRepository,
    private readonly contentRepo: ContentRepository,
  ) {}

  async getQuizForAttempt(quizId: string, studentId: string): Promise<QuizForAttempt> {
    await this.assertAccess(quizId, studentId);

    const quiz = await this.quizRepo.findQuizById(quizId);
    if (!quiz) {
      // Genuinely inconsistent state (passed assertAccess a moment ago,
      // gone now) rather than a normal path — same 404 either way.
      throw ApiError.notFound('QUIZ_NOT_FOUND', 'Quiz not found');
    }

    return {
      id: quiz.id,
      title: quiz.title,
      passPercent: quiz.passPercent,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        text: q.text,
        order: q.order,
        // No isCorrect — this is the entire point of this method existing
        // separately from the teacher-facing findQuizById.
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
      })),
    };
  }

  async submitQuizAttempt(
    quizId: string,
    studentId: string,
    input: SubmitAnswersInput,
  ): Promise<QuizAttemptResult> {
    await this.assertAccess(quizId, studentId);

    const quiz = await this.quizRepo.findQuizById(quizId);
    if (!quiz) {
      throw ApiError.notFound('QUIZ_NOT_FOUND', 'Quiz not found');
    }

    // One answer per question, last one wins if a question was somehow
    // submitted twice — simplest reasonable handling of a duplicate,
    // not treated as an attack on its own.
    const submittedByQuestion = new Map<string, string>();
    for (const answer of input.answers) {
      submittedByQuestion.set(answer.questionId, answer.optionId);
    }

    // Validate every submitted question/option actually belongs to THIS
    // quiz before scoring anything — never trust IDs from the frontend.
    const validQuestionIds = new Set(quiz.questions.map((q) => q.id));
    for (const questionId of submittedByQuestion.keys()) {
      if (!validQuestionIds.has(questionId)) {
        throw ApiError.badRequest('INVALID_QUESTION_ID', 'A submitted question does not belong to this quiz');
      }
    }

    const questionResults: QuestionResult[] = quiz.questions.map((question) => {
      const correctOption = question.options.find((o) => o.isCorrect)!; // guaranteed by createQuiz/updateQuiz's own validation (assertValidQuestions)
      const selectedOptionId = submittedByQuestion.get(question.id) ?? null;

      if (selectedOptionId !== null && !question.options.some((o) => o.id === selectedOptionId)) {
        throw ApiError.badRequest(
          'INVALID_OPTION_ID',
          'A submitted option does not belong to its question',
        );
      }

      return {
        questionId: question.id,
        selectedOptionId,
        correctOptionId: correctOption.id,
        isCorrect: selectedOptionId === correctOption.id,
      };
    });

    const score = questionResults.filter((r) => r.isCorrect).length;
    const totalMarks = quiz.questions.length;
    const attempt = await this.attemptRepo.createAttempt(quizId, studentId, score, totalMarks);

    return {
      id: attempt.id,
      score,
      totalMarks,
      passPercent: quiz.passPercent,
      passed: totalMarks > 0 && (score / totalMarks) * 100 >= quiz.passPercent,
      attemptedAt: attempt.attemptedAt,
      questionResults,
    };
  }

  /** Only the aggregate score — `questionResults` was never persisted
   * (QuizAttempt only stores score/totalMarks), so a *previous* attempt
   * can't show per-question correctness the way a fresh submission's
   * response can. See quiz-attempts.types.ts's module comment. */
  async getMyLatestAttempt(quizId: string, studentId: string): Promise<QuizAttemptSummary | null> {
    await this.assertAccess(quizId, studentId);

    const attempt = await this.attemptRepo.findLatestAttempt(quizId, studentId);
    if (!attempt) return null;

    return { id: attempt.id, score: attempt.score, totalMarks: attempt.totalMarks, attemptedAt: attempt.attemptedAt };
  }

  private async assertAccess(quizId: string, studentId: string): Promise<void> {
    const access = await this.attemptRepo.findQuizForAccess(quizId);
    // A quiz whose course isn't PUBLISHED (or that's been soft-deleted)
    // doesn't exist from a student's perspective, regardless of
    // enrollment — same 404 as a genuinely missing quiz, matching
    // ContentService's identical treatment of DRAFT/HIDDEN lectures.
    if (!access) {
      throw ApiError.notFound('QUIZ_NOT_FOUND', 'Quiz not found');
    }

    const enrolled = await this.contentRepo.isStudentEnrolled(studentId, access.courseId);
    if (!enrolled) {
      throw ApiError.forbidden('NOT_ENROLLED', 'You are not enrolled in this course');
    }
  }
}
