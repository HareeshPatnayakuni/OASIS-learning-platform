import { Router } from 'express';
import { TeacherCourseController } from './courses.teacher.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  courseIdParamsSchema,
  createCourseBodySchema,
  updateCourseBodySchema,
  updateCourseStatusBodySchema,
} from './courses.teacher.validators';

const router = Router();
const controller = new TeacherCourseController();

/**
 * IMPORTANT: this router is mounted at /api/v1/courses in app.ts BEFORE
 * the frozen Module 3A `coursesRouter` (same base path). `GET /mine` has
 * to be registered ahead of Module 3A's `GET /:slug` or Express would
 * match "mine" as a slug value instead of this route. Don't reorder the
 * app.use() calls in app.ts without keeping this in mind.
 *
 * @openapi
 * /courses/mine:
 *   get:
 *     tags: [Courses]
 *     summary: "Teacher Dashboard: my courses, every status, with basic stats"
 *     description: >
 *       Unlike the public GET /courses (published only), this returns
 *       every course the authenticated teacher owns regardless of status,
 *       each with enrollmentCount/totalLectures/publishedLectures — the
 *       "Course statistics (basic)" the Teacher Dashboard needs, not a
 *       full analytics feature (explicitly out of scope for Module 3B).
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The teacher's own courses }
 */
router.get('/mine', authenticate, requireRole('TEACHER'), asyncHandler(controller.listMine));

/**
 * @openapi
 * /courses/mine/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: "A single course you own, any status (for the Edit Course / Course Builder pages)"
 *     description: >
 *       Distinct path from Module 3A's public GET /courses/{slug} on
 *       purpose — that route only ever returns PUBLISHED courses looked
 *       up by slug, which can't serve a DRAFT course back to its own
 *       teacher for editing. This one is ID-based, any status, ownership-checked.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: The course }
 *       403: { description: You do not own this course }
 *       404: { description: Course not found }
 */
router.get(
  '/mine/:id',
  authenticate,
  requireRole('TEACHER'),
  validate({ params: courseIdParamsSchema }),
  asyncHandler(controller.getMine),
);

/**
 * @openapi
 * /courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a course (starts as DRAFT)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, boardId, classGradeId, subjectId, price]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               boardId: { type: string, format: uuid }
 *               classGradeId: { type: string, format: uuid }
 *               subjectId: { type: string, format: uuid }
 *               price: { type: number }
 *               discountPrice: { type: number, nullable: true }
 *     responses:
 *       201: { description: Course created }
 */
router.post(
  '/',
  authenticate,
  requireRole('TEACHER'),
  validate({ body: createCourseBodySchema }),
  asyncHandler(controller.create),
);

/**
 * @openapi
 * /courses/{id}:
 *   patch:
 *     tags: [Courses]
 *     summary: Edit a course you own
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               boardId: { type: string, format: uuid }
 *               classGradeId: { type: string, format: uuid }
 *               subjectId: { type: string, format: uuid }
 *               price: { type: number }
 *               discountPrice: { type: number, nullable: true }
 *               thumbnailId: { type: string, format: uuid, nullable: true, description: "Media ID from POST /media (purpose=COURSE_THUMBNAIL)" }
 *     responses:
 *       200: { description: Updated course }
 *       403: { description: You do not own this course }
 *       404: { description: Course not found }
 */
router.patch(
  '/:id',
  authenticate,
  requireRole('TEACHER'),
  validate({ params: courseIdParamsSchema, body: updateCourseBodySchema }),
  asyncHandler(controller.update),
);

/**
 * @openapi
 * /courses/{id}/status:
 *   patch:
 *     tags: [Courses]
 *     summary: Save as Draft / Publish / Archive a course you own
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *     responses:
 *       200: { description: Status updated }
 *       403: { description: You do not own this course }
 *       404: { description: Course not found }
 */
router.patch(
  '/:id/status',
  authenticate,
  requireRole('TEACHER'),
  validate({ params: courseIdParamsSchema, body: updateCourseStatusBodySchema }),
  asyncHandler(controller.updateStatus),
);

export { router as teacherCoursesRouter };
