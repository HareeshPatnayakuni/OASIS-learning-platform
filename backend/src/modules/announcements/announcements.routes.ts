import { Router } from 'express';
import { TeacherAnnouncementController } from './announcements.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  announcementIdParamsSchema,
  courseIdParamsSchema,
  createAnnouncementBodySchema,
  paginationQuerySchema,
  updateAnnouncementBodySchema,
} from './announcements.validators';

const router = Router();
const controller = new TeacherAnnouncementController();
const teacherOnly = [authenticate, requireRole('TEACHER')] as const;

/**
 * @openapi
 * /announcements/mine:
 *   get:
 *     tags: [Announcements]
 *     summary: "Teacher Dashboard: announcements I've posted, most recent first"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Paginated list of the teacher's own announcements }
 */
router.get('/announcements/mine', ...teacherOnly, validate({ query: paginationQuerySchema }), asyncHandler(controller.listMine));

/**
 * @openapi
 * /courses/{courseId}/announcements:
 *   post:
 *     tags: [Announcements]
 *     summary: Post an announcement to a course you own
 *     description: >
 *       Also creates a Notification for every currently-enrolled student
 *       (docs/02-architecture.md §6.1) — visible via
 *       GET /users/me/announcements and (for students) their notifications.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: courseId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties: { title: { type: string }, body: { type: string } }
 *     responses:
 *       201: { description: Announcement posted }
 */
router.post(
  '/courses/:courseId/announcements',
  ...teacherOnly,
  validate({ params: courseIdParamsSchema, body: createAnnouncementBodySchema }),
  asyncHandler(controller.create),
);

/**
 * @openapi
 * /announcements/{id}:
 *   patch:
 *     tags: [Announcements]
 *     summary: Edit an announcement you posted
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { title: { type: string }, body: { type: string } } }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Announcements]
 *     summary: Delete an announcement you posted (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       204: { description: Deleted }
 */
router.patch(
  '/announcements/:id',
  ...teacherOnly,
  validate({ params: announcementIdParamsSchema, body: updateAnnouncementBodySchema }),
  asyncHandler(controller.update),
);
router.delete(
  '/announcements/:id',
  ...teacherOnly,
  validate({ params: announcementIdParamsSchema }),
  asyncHandler(controller.remove),
);

export { router as teacherAnnouncementsRouter };
