import { ApiError } from '../../utils/ApiError';
import { isCourseOwnedByTeacher, getCourseIdForContentModule, getCourseIdForQuiz } from '../../lib/ownership';
import type {
  CreateQuizInput,
  QuestionInput,
  QuizRecord,
  QuizRepository,
  UpdateQuizInput,
} from './quizzes.types';

export class QuizzesService {
  constructor(private readonly repo: QuizRepository) {}

  async getQuiz(quizId: string, teacherId: string): Promise<QuizRecord> {
    return this.assertQuizOwnership(quizId, teacherId);
  }

  async createQuiz(moduleId: string, teacherId: string, input: CreateQuizInput): Promise<QuizRecord> {
    this.assertValidQuestions(input.questions);
    await this.assertModuleOwnershipForCreate(moduleId, teacherId);
    return this.repo.createQuiz(moduleId, input);
  }

  async updateQuiz(quizId: string, teacherId: string, input: UpdateQuizInput): Promise<QuizRecord> {
    if (input.questions !== undefined) {
      this.assertValidQuestions(input.questions);
    }
    await this.assertQuizOwnership(quizId, teacherId);
    return this.repo.updateQuiz(quizId, input);
  }

  async deleteQuiz(quizId: string, teacherId: string): Promise<void> {
    await this.assertQuizOwnership(quizId, teacherId);
    await this.repo.softDeleteQuiz(quizId);
  }

  /** A quiz with no way to score correctly, or a question with no way to
   * be answered, is a data-integrity problem worth rejecting up front
   * rather than letting a future Student-facing "take quiz" feature (not
   * built yet) discover it at attempt time. */
  private assertValidQuestions(questions: QuestionInput[]): void {
    if (questions.length === 0) {
      throw ApiError.badRequest('QUIZ_NEEDS_QUESTIONS', 'A quiz must have at least one question');
    }
    questions.forEach((question, index) => {
      if (question.options.length < 2) {
        throw ApiError.badRequest(
          'QUESTION_NEEDS_OPTIONS',
          `Question ${index + 1} must have at least 2 options`,
        );
      }
      if (!question.options.some((o) => o.isCorrect)) {
        throw ApiError.badRequest(
          'QUESTION_NEEDS_CORRECT_OPTION',
          `Question ${index + 1} must have at least one correct option`,
        );
      }
    });
  }

  private async assertModuleOwnershipForCreate(moduleId: string, teacherId: string): Promise<void> {
    const courseId = await getCourseIdForContentModule(moduleId);
    if (!courseId) {
      throw ApiError.notFound('MODULE_NOT_FOUND', 'Module not found');
    }
    const owned = await isCourseOwnedByTeacher(courseId, teacherId);
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'You do not own this course');
    }
  }

  private async assertQuizOwnership(quizId: string, teacherId: string): Promise<QuizRecord> {
    const quiz = await this.repo.findQuizById(quizId);
    if (!quiz) {
      throw ApiError.notFound('QUIZ_NOT_FOUND', 'Quiz not found');
    }
    const courseId = await getCourseIdForQuiz(quizId);
    const owned = courseId ? await isCourseOwnedByTeacher(courseId, teacherId) : false;
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'You do not own this course');
    }
    return quiz;
  }
}
