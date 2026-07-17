import { randomUUID } from 'node:crypto';
import { QuizAttemptService } from '../../../src/modules/quizzes/quiz-attempts.service';
import { createFakeContentRepository } from '../content/fakeContentRepository';
import type { QuizRecord, QuizRepository } from '../../../src/modules/quizzes/quizzes.types';
import type { QuizAttemptRecord, QuizAttemptRepository } from '../../../src/modules/quizzes/quiz-attempts.types';

const QUIZ_ID = 'quiz-1';
const COURSE_ID = 'course-1';
const STUDENT_ID = 'student-1';
const Q1 = 'question-1';
const Q1_CORRECT = 'q1-option-correct';
const Q1_WRONG = 'q1-option-wrong';
const Q2 = 'question-2';
const Q2_CORRECT = 'q2-option-correct';
const Q2_WRONG = 'q2-option-wrong';

function buildQuiz(overrides: Partial<QuizRecord> = {}): QuizRecord {
  return {
    id: QUIZ_ID,
    moduleId: 'module-1',
    title: 'Algebra Basics Quiz',
    passPercent: 50,
    questions: [
      {
        id: Q1,
        text: 'What is 2 + 2?',
        order: 1,
        options: [
          { id: Q1_WRONG, text: '3', isCorrect: false },
          { id: Q1_CORRECT, text: '4', isCorrect: true },
        ],
      },
      {
        id: Q2,
        text: 'What is 3 + 3?',
        order: 2,
        options: [
          { id: Q2_CORRECT, text: '6', isCorrect: true },
          { id: Q2_WRONG, text: '7', isCorrect: false },
        ],
      },
    ],
    ...overrides,
  };
}

function createFakeQuizRepository(quiz: QuizRecord | null = buildQuiz()) {
  const repo: QuizRepository = {
    async createQuiz() {
      throw new Error('not used in these tests');
    },
    async findQuizById(id: string) {
      return quiz && quiz.id === id ? quiz : null;
    },
    async updateQuiz() {
      throw new Error('not used in these tests');
    },
    async softDeleteQuiz() {
      throw new Error('not used in these tests');
    },
  };
  return repo;
}

function createFakeQuizAttemptRepository(seed: { accessible?: boolean; existingAttempts?: QuizAttemptRecord[] } = {}) {
  const accessible = seed.accessible ?? true;
  const attempts: QuizAttemptRecord[] = seed.existingAttempts ?? [];

  const repo: QuizAttemptRepository = {
    async findQuizForAccess(quizId: string) {
      return accessible && quizId === QUIZ_ID ? { courseId: COURSE_ID } : null;
    },
    async createAttempt(quizId, studentId, score, totalMarks) {
      const record: QuizAttemptRecord = {
        id: randomUUID(),
        quizId,
        studentId,
        score,
        totalMarks,
        attemptedAt: new Date(),
      };
      attempts.push(record);
      return record;
    },
    async findLatestAttempt(quizId, studentId) {
      const mine = attempts
        .filter((a) => a.quizId === quizId && a.studentId === studentId)
        .sort((a, b) => b.attemptedAt.getTime() - a.attemptedAt.getTime());
      return mine[0] ?? null;
    },
  };
  return { repo, attempts };
}

function buildService(options: {
  quiz?: QuizRecord | null;
  attemptAccessible?: boolean;
  existingAttempts?: QuizAttemptRecord[];
  enrolled?: boolean;
}) {
  const quizRepo = createFakeQuizRepository(options.quiz !== undefined ? options.quiz : buildQuiz());
  const { repo: attemptRepo, attempts } = createFakeQuizAttemptRepository({
    accessible: options.attemptAccessible,
    existingAttempts: options.existingAttempts,
  });
  const contentRepo = createFakeContentRepository({
    enrollments: options.enrolled === false ? new Set() : new Set([`${STUDENT_ID}:${COURSE_ID}`]),
  }).repo;
  const service = new QuizAttemptService(quizRepo, attemptRepo, contentRepo);
  return { service, attempts };
}

describe('QuizAttemptService.getQuizForAttempt', () => {
  it('returns the quiz for an enrolled student, with no isCorrect field anywhere', async () => {
    const { service } = buildService({});

    const quiz = await service.getQuizForAttempt(QUIZ_ID, STUDENT_ID);

    expect(quiz.title).toBe('Algebra Basics Quiz');
    expect(quiz.questions).toHaveLength(2);
    for (const question of quiz.questions) {
      for (const option of question.options) {
        expect(option).not.toHaveProperty('isCorrect');
      }
    }
  });

  it('rejects a non-enrolled student with 403, not 404', async () => {
    const { service } = buildService({ enrolled: false });

    await expect(service.getQuizForAttempt(QUIZ_ID, STUDENT_ID)).rejects.toMatchObject({
      code: 'NOT_ENROLLED',
      statusCode: 403,
    });
  });

  it("404s for a quiz whose course isn't published (or that doesn't exist) — before even checking enrollment", async () => {
    const { service } = buildService({ attemptAccessible: false, enrolled: false });

    await expect(service.getQuizForAttempt(QUIZ_ID, STUDENT_ID)).rejects.toMatchObject({
      code: 'QUIZ_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('QuizAttemptService.submitQuizAttempt', () => {
  it('calculates the score correctly on the backend from the real answer key', async () => {
    const { service } = buildService({});

    const result = await service.submitQuizAttempt(QUIZ_ID, STUDENT_ID, {
      answers: [
        { questionId: Q1, optionId: Q1_CORRECT },
        { questionId: Q2, optionId: Q2_WRONG },
      ],
    });

    expect(result.score).toBe(1);
    expect(result.totalMarks).toBe(2);
    expect(result.passed).toBe(true); // 50% meets passPercent: 50
  });

  it('never trusts a score from the frontend — only questionId/optionId are accepted, no score field exists to submit', async () => {
    const { service } = buildService({});

    const result = await service.submitQuizAttempt(QUIZ_ID, STUDENT_ID, {
      answers: [
        { questionId: Q1, optionId: Q1_WRONG },
        { questionId: Q2, optionId: Q2_WRONG },
      ],
    });

    expect(result.score).toBe(0);
  });

  it('includes per-question correctness for this fresh submission', async () => {
    const { service } = buildService({});

    const result = await service.submitQuizAttempt(QUIZ_ID, STUDENT_ID, {
      answers: [{ questionId: Q1, optionId: Q1_CORRECT }],
    });

    expect(result.questionResults).toEqual([
      { questionId: Q1, selectedOptionId: Q1_CORRECT, correctOptionId: Q1_CORRECT, isCorrect: true },
      { questionId: Q2, selectedOptionId: null, correctOptionId: Q2_CORRECT, isCorrect: false },
    ]);
  });

  it('stores the attempt using the existing QuizAttempt model', async () => {
    const { service, attempts } = buildService({});

    await service.submitQuizAttempt(QUIZ_ID, STUDENT_ID, {
      answers: [{ questionId: Q1, optionId: Q1_CORRECT }],
    });

    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ quizId: QUIZ_ID, studentId: STUDENT_ID, score: 1, totalMarks: 2 });
  });

  it('rejects a question ID that does not belong to this quiz', async () => {
    const { service } = buildService({});

    await expect(
      service.submitQuizAttempt(QUIZ_ID, STUDENT_ID, {
        answers: [{ questionId: 'question-from-another-quiz', optionId: Q1_CORRECT }],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_QUESTION_ID', statusCode: 400 });
  });

  it('rejects an option ID that does not belong to the corresponding question', async () => {
    const { service } = buildService({});

    // Q2_CORRECT is a real option ID, but it belongs to Q2, not Q1.
    await expect(
      service.submitQuizAttempt(QUIZ_ID, STUDENT_ID, {
        answers: [{ questionId: Q1, optionId: Q2_CORRECT }],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_OPTION_ID', statusCode: 400 });
  });

  it('rejects a non-enrolled student', async () => {
    const { service } = buildService({ enrolled: false });

    await expect(
      service.submitQuizAttempt(QUIZ_ID, STUDENT_ID, { answers: [{ questionId: Q1, optionId: Q1_CORRECT }] }),
    ).rejects.toMatchObject({ code: 'NOT_ENROLLED', statusCode: 403 });
  });

  it('allows a second attempt, creating a new row rather than replacing the first (existing schema has no unique constraint)', async () => {
    const { service, attempts } = buildService({});

    await service.submitQuizAttempt(QUIZ_ID, STUDENT_ID, { answers: [{ questionId: Q1, optionId: Q1_WRONG }] });
    await service.submitQuizAttempt(QUIZ_ID, STUDENT_ID, { answers: [{ questionId: Q1, optionId: Q1_CORRECT }] });

    expect(attempts).toHaveLength(2);
  });
});

describe('QuizAttemptService.getMyLatestAttempt', () => {
  it('returns null when the student has never attempted this quiz', async () => {
    const { service } = buildService({});

    await expect(service.getMyLatestAttempt(QUIZ_ID, STUDENT_ID)).resolves.toBeNull();
  });

  it('returns only the most recent attempt when multiple exist, with no question-level detail', async () => {
    const older: QuizAttemptRecord = {
      id: 'attempt-old',
      quizId: QUIZ_ID,
      studentId: STUDENT_ID,
      score: 0,
      totalMarks: 2,
      attemptedAt: new Date('2026-01-01'),
    };
    const newer: QuizAttemptRecord = {
      id: 'attempt-new',
      quizId: QUIZ_ID,
      studentId: STUDENT_ID,
      score: 2,
      totalMarks: 2,
      attemptedAt: new Date('2026-02-01'),
    };
    const { service } = buildService({ existingAttempts: [older, newer] });

    const result = await service.getMyLatestAttempt(QUIZ_ID, STUDENT_ID);

    expect(result).toEqual({ id: 'attempt-new', score: 2, totalMarks: 2, attemptedAt: newer.attemptedAt });
    expect(result).not.toHaveProperty('questionResults');
  });

  it("never returns another student's attempt — the query is scoped by studentId, not filtered after the fact", async () => {
    const someoneElsesAttempt: QuizAttemptRecord = {
      id: 'attempt-other',
      quizId: QUIZ_ID,
      studentId: 'a-different-student',
      score: 2,
      totalMarks: 2,
      attemptedAt: new Date(),
    };
    const { service } = buildService({ existingAttempts: [someoneElsesAttempt] });

    await expect(service.getMyLatestAttempt(QUIZ_ID, STUDENT_ID)).resolves.toBeNull();
  });
});
