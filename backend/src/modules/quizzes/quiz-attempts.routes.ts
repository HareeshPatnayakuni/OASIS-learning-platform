import { Router } from 'express';
import { QuizAttemptController } from './quiz-attempts.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { quizIdNestedParamsSchema, submitAnswersBodySchema } from './quiz-attempts.validators';

const router = Router();
const controller = new QuizAttemptController();
const studentOnly = [authenticate, requireRole('STUDENT')] as const;

/**
 * @openapi
 * /quizzes/{quizId}/attempt:
 *   get:
 *     tags: [Quizzes]
 *     summary: Get a quiz to take (Student) — questions and options only, never correct answers
 *     description: Requires enrollment in the quiz's parent course. Same 404 whether the quiz doesn't exist or its course isn't currently published.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: quizId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Quiz ready to take }
 *       403: { description: Not enrolled in this course }
 *       404: { description: Quiz not found }
 *   post:
 *     tags: [Quizzes]
 *     summary: Submit answers and receive a scored result (Student)
 *     description: >
 *       The score is always computed server-side from the real
 *       correct-answer data — never trusted from the request. Every
 *       submitted questionId/optionId is validated against this quiz's
 *       actual structure and rejected if it doesn't belong. Creates a new
 *       QuizAttempt row (multiple attempts are allowed — see
 *       docs/16-module-6-notes.md for the attempt policy).
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: quizId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [questionId, optionId]
 *                   properties: { questionId: { type: string }, optionId: { type: string } }
 *     responses:
 *       201: { description: Scored result, including per-question correctness for this submission }
 *       400: { description: A submitted question/option does not belong to this quiz }
 *       403: { description: Not enrolled in this course }
 *       404: { description: Quiz not found }
 */
router.get(
  '/quizzes/:quizId/attempt',
  ...studentOnly,
  validate({ params: quizIdNestedParamsSchema }),
  asyncHandler(controller.getQuizForAttempt),
);
router.post(
  '/quizzes/:quizId/attempt',
  ...studentOnly,
  validate({ params: quizIdNestedParamsSchema, body: submitAnswersBodySchema }),
  asyncHandler(controller.submitQuizAttempt),
);

/**
 * @openapi
 * /quizzes/{quizId}/my-attempt:
 *   get:
 *     tags: [Quizzes]
 *     summary: The requesting student's own most recent attempt at this quiz, if any (Student)
 *     description: >
 *       Aggregate score only (no per-question breakdown — that's only
 *       ever available in a fresh submission's own response, since it
 *       isn't persisted). Returns `null` data if the student hasn't
 *       attempted this quiz yet, not a 404.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: quizId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Previous attempt, or null if none exists }
 *       403: { description: Not enrolled in this course }
 *       404: { description: Quiz not found }
 */
router.get(
  '/quizzes/:quizId/my-attempt',
  ...studentOnly,
  validate({ params: quizIdNestedParamsSchema }),
  asyncHandler(controller.getMyLatestAttempt),
);

export { router as quizAttemptsRouter };
