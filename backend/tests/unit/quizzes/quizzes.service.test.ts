import { randomUUID } from 'node:crypto';
import { QuizzesService } from '../../../src/modules/quizzes/quizzes.service';
import type { CreateQuizInput, QuizRecord, QuizRepository, UpdateQuizInput } from '../../../src/modules/quizzes/quizzes.types';
import * as ownershipLib from '../../../src/lib/ownership';

jest.mock('../../../src/lib/ownership', () => ({
  isCourseOwnedByTeacher: jest.fn(),
  getCourseIdForContentModule: jest.fn(),
  getCourseIdForQuiz: jest.fn(),
}));

const mockedIsCourseOwnedByTeacher = ownershipLib.isCourseOwnedByTeacher as jest.MockedFunction<
  typeof ownershipLib.isCourseOwnedByTeacher
>;
const mockedGetCourseIdForContentModule = ownershipLib.getCourseIdForContentModule as jest.MockedFunction<
  typeof ownershipLib.getCourseIdForContentModule
>;
const mockedGetCourseIdForQuiz = ownershipLib.getCourseIdForQuiz as jest.MockedFunction<
  typeof ownershipLib.getCourseIdForQuiz
>;

function createFakeQuizRepository() {
  const quizzes = new Map<string, QuizRecord>();

  const repo: QuizRepository = {
    async createQuiz(moduleId: string, input: CreateQuizInput) {
      const record: QuizRecord = {
        id: randomUUID(),
        moduleId,
        title: input.title,
        passPercent: input.passPercent ?? 40,
        questions: input.questions.map((q, i) => ({
          id: randomUUID(),
          text: q.text,
          order: i + 1,
          options: q.options.map((o) => ({ id: randomUUID(), text: o.text, isCorrect: o.isCorrect })),
        })),
      };
      quizzes.set(record.id, record);
      return record;
    },
    async findQuizById(id: string) {
      return quizzes.get(id) ?? null;
    },
    async updateQuiz(id: string, input: UpdateQuizInput) {
      const existing = quizzes.get(id)!;
      const updated: QuizRecord = {
        ...existing,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.passPercent !== undefined ? { passPercent: input.passPercent } : {}),
        ...(input.questions !== undefined
          ? {
              questions: input.questions.map((q, i) => ({
                id: randomUUID(),
                text: q.text,
                order: i + 1,
                options: q.options.map((o) => ({ id: randomUUID(), text: o.text, isCorrect: o.isCorrect })),
              })),
            }
          : {}),
      };
      quizzes.set(id, updated);
      return updated;
    },
    async softDeleteQuiz(id: string) {
      quizzes.delete(id);
    },
  };

  return { repo, quizzes };
}

const MODULE_ID = 'module-1';
const COURSE_ID = 'course-1';
const TEACHER_ID = 'teacher-1';

const VALID_QUESTIONS = [
  { text: 'What is 2+2?', options: [{ text: '3', isCorrect: false }, { text: '4', isCorrect: true }] },
];

beforeEach(() => {
  mockedGetCourseIdForContentModule.mockResolvedValue(COURSE_ID);
  mockedGetCourseIdForQuiz.mockResolvedValue(COURSE_ID);
});

describe('QuizzesService.getQuiz', () => {
  it('returns a quiz the teacher owns, with full questions and options', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);
    const created = await service.createQuiz(MODULE_ID, TEACHER_ID, { title: 'X', questions: VALID_QUESTIONS });

    const fetched = await service.getQuiz(created.id, TEACHER_ID);
    expect(fetched.questions).toHaveLength(1);
  });

  it('rejects fetching a quiz owned by a different teacher', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValueOnce(true);
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);
    const created = await service.createQuiz(MODULE_ID, TEACHER_ID, { title: 'X', questions: VALID_QUESTIONS });

    mockedIsCourseOwnedByTeacher.mockResolvedValueOnce(false);
    await expect(service.getQuiz(created.id, 'teacher-2')).rejects.toMatchObject({
      code: 'NOT_COURSE_OWNER',
      statusCode: 403,
    });
  });
});

describe('QuizzesService.createQuiz', () => {
  it('creates a quiz with valid questions', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);

    const quiz = await service.createQuiz(MODULE_ID, TEACHER_ID, {
      title: 'Chapter 1 Quiz',
      questions: VALID_QUESTIONS,
    });

    expect(quiz.questions).toHaveLength(1);
    expect(quiz.passPercent).toBe(40); // default
  });

  it('rejects a quiz with zero questions', async () => {
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);

    await expect(
      service.createQuiz(MODULE_ID, TEACHER_ID, { title: 'Empty Quiz', questions: [] }),
    ).rejects.toMatchObject({ code: 'QUIZ_NEEDS_QUESTIONS', statusCode: 400 });
  });

  it('rejects a question with fewer than 2 options', async () => {
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);

    await expect(
      service.createQuiz(MODULE_ID, TEACHER_ID, {
        title: 'X',
        questions: [{ text: 'Q1', options: [{ text: 'Only one', isCorrect: true }] }],
      }),
    ).rejects.toMatchObject({ code: 'QUESTION_NEEDS_OPTIONS', statusCode: 400 });
  });

  it('rejects a question with no correct option', async () => {
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);

    await expect(
      service.createQuiz(MODULE_ID, TEACHER_ID, {
        title: 'X',
        questions: [
          { text: 'Q1', options: [{ text: 'A', isCorrect: false }, { text: 'B', isCorrect: false }] },
        ],
      }),
    ).rejects.toMatchObject({ code: 'QUESTION_NEEDS_CORRECT_OPTION', statusCode: 400 });
  });

  it('validates BEFORE checking ownership (fails fast on bad input)', async () => {
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);

    await expect(
      service.createQuiz(MODULE_ID, TEACHER_ID, { title: 'X', questions: [] }),
    ).rejects.toMatchObject({ code: 'QUIZ_NEEDS_QUESTIONS' });
    expect(mockedIsCourseOwnedByTeacher).not.toHaveBeenCalled();
  });

  it('rejects creation for a module in a course the teacher does not own', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(false);
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);

    await expect(
      service.createQuiz(MODULE_ID, TEACHER_ID, { title: 'X', questions: VALID_QUESTIONS }),
    ).rejects.toMatchObject({ code: 'NOT_COURSE_OWNER', statusCode: 403 });
  });
});

describe('QuizzesService.updateQuiz', () => {
  it('wholesale-replaces questions when a new question set is provided', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);
    const quiz = await service.createQuiz(MODULE_ID, TEACHER_ID, { title: 'X', questions: VALID_QUESTIONS });

    const newQuestions = [
      { text: 'New Q1', options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }] },
      { text: 'New Q2', options: [{ text: 'C', isCorrect: true }, { text: 'D', isCorrect: false }] },
    ];
    const updated = await service.updateQuiz(quiz.id, TEACHER_ID, { questions: newQuestions });

    expect(updated.questions).toHaveLength(2);
    expect(updated.questions[0]?.text).toBe('New Q1');
  });

  it('rejects an invalid replacement question set', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);
    const quiz = await service.createQuiz(MODULE_ID, TEACHER_ID, { title: 'X', questions: VALID_QUESTIONS });

    await expect(
      service.updateQuiz(quiz.id, TEACHER_ID, { questions: [] }),
    ).rejects.toMatchObject({ code: 'QUIZ_NEEDS_QUESTIONS' });
  });

  it('allows updating just the title without touching questions', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);
    const quiz = await service.createQuiz(MODULE_ID, TEACHER_ID, { title: 'Old Title', questions: VALID_QUESTIONS });

    const updated = await service.updateQuiz(quiz.id, TEACHER_ID, { title: 'New Title' });
    expect(updated.title).toBe('New Title');
    expect(updated.questions).toHaveLength(1); // unchanged
  });

  it('404s for a quiz that does not exist', async () => {
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);

    await expect(service.updateQuiz('nope', TEACHER_ID, { title: 'X' })).rejects.toMatchObject({
      code: 'QUIZ_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('rejects updating a quiz owned by a different teacher', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValueOnce(true);
    const { repo } = createFakeQuizRepository();
    const service = new QuizzesService(repo);
    const quiz = await service.createQuiz(MODULE_ID, TEACHER_ID, { title: 'X', questions: VALID_QUESTIONS });

    mockedIsCourseOwnedByTeacher.mockResolvedValueOnce(false);
    await expect(service.updateQuiz(quiz.id, 'teacher-2', { title: 'Hijacked' })).rejects.toMatchObject({
      code: 'NOT_COURSE_OWNER',
      statusCode: 403,
    });
  });
});

describe('QuizzesService.deleteQuiz', () => {
  it('soft-deletes a quiz the teacher owns', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo, quizzes } = createFakeQuizRepository();
    const service = new QuizzesService(repo);
    const quiz = await service.createQuiz(MODULE_ID, TEACHER_ID, { title: 'X', questions: VALID_QUESTIONS });

    await service.deleteQuiz(quiz.id, TEACHER_ID);
    expect(quizzes.has(quiz.id)).toBe(false);
  });
});
