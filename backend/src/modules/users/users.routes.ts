import { Router } from 'express';
import { UserController } from './users.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { paginationQuerySchema, updateProfileBodySchema } from './users.validators';

const router = Router();
const controller = new UserController();

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Current user's profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile }
 *   patch:
 *     tags: [Users]
 *     summary: Update current user's profile
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               phone: { type: string, nullable: true }
 *               classGradeId: { type: string, format: uuid, nullable: true }
 *               boardId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       200: { description: Updated profile }
 *       400: { description: Invalid classGradeId/boardId reference }
 */
router.get('/me', authenticate, asyncHandler(controller.getMe));
router.patch(
  '/me',
  authenticate,
  validate({ body: updateProfileBodySchema }),
  asyncHandler(controller.updateMe),
);

/**
 * @openapi
 * /users/me/streak:
 *   get:
 *     tags: [Users]
 *     summary: Current student's Learning Streak
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current/longest streak and last active date }
 */
router.get('/me/streak', authenticate, requireRole('STUDENT'), asyncHandler(controller.getMyStreak));

/**
 * @openapi
 * /users/me/continue-watching:
 *   get:
 *     tags: [Users]
 *     summary: Recently active, not-yet-completed lectures across all enrolled courses
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Up to 5 most recently active in-progress lectures, with course/chapter/module context for deep-linking }
 */
router.get(
  '/me/continue-watching',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(controller.getMyContinueWatching),
);

/**
 * @openapi
 * /users/me/announcements:
 *   get:
 *     tags: [Users]
 *     summary: Announcements across all of the student's enrolled courses
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Paginated announcements, most recent first }
 */
router.get(
  '/me/announcements',
  authenticate,
  requireRole('STUDENT'),
  validate({ query: paginationQuerySchema }),
  asyncHandler(controller.getMyAnnouncements),
);

export { router as usersRouter };
