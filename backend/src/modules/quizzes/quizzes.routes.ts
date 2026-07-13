import { Router } from 'express';
import { QuizzesController } from './quizzes.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createQuizBodySchema,
  moduleIdNestedParamsSchema,
  quizIdParamsSchema,
  updateQuizBodySchema,
} from './quizzes.validators';

const router = Router();
const controller = new QuizzesController();
const teacherOnly = [authenticate, requireRole('TEACHER')] as const;

/**
 * @openapi
 * /modules/{moduleId}/quizzes:
 *   post:
 *     tags: [Quizzes]
 *     summary: Create a quiz with its questions and options
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: moduleId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, questions]
 *             properties:
 *               title: { type: string }
 *               passPercent: { type: integer, minimum: 0, maximum: 100, default: 40 }
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [text, options]
 *                   properties:
 *                     text: { type: string }
 *                     options:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required: [text, isCorrect]
 *                         properties: { text: { type: string }, isCorrect: { type: boolean } }
 *     responses:
 *       201: { description: Quiz created }
 *       400: { description: "Invalid quiz — e.g. a question with fewer than 2 options or no correct option" }
 */
router.post(
  '/modules/:moduleId/quizzes',
  ...teacherOnly,
  validate({ params: moduleIdNestedParamsSchema, body: createQuizBodySchema }),
  asyncHandler(controller.create),
);

/**
 * @openapi
 * /quizzes/{id}:
 *   get:
 *     tags: [Quizzes]
 *     summary: Get a quiz you own, with its full questions and options (for the Edit Quiz form)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: The quiz }
 *       403: { description: You do not own this course }
 *       404: { description: Quiz not found }
 *   patch:
 *     tags: [Quizzes]
 *     summary: Edit a quiz. Providing `questions` replaces the entire question set.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               passPercent: { type: integer }
 *               questions: { type: array, items: { type: object } }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Quizzes]
 *     summary: Delete a quiz (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       204: { description: Deleted }
 */
router.get(
  '/quizzes/:id',
  ...teacherOnly,
  validate({ params: quizIdParamsSchema }),
  asyncHandler(controller.get),
);
router.patch(
  '/quizzes/:id',
  ...teacherOnly,
  validate({ params: quizIdParamsSchema, body: updateQuizBodySchema }),
  asyncHandler(controller.update),
);
router.delete(
  '/quizzes/:id',
  ...teacherOnly,
  validate({ params: quizIdParamsSchema }),
  asyncHandler(controller.remove),
);

export { router as quizzesRouter };
