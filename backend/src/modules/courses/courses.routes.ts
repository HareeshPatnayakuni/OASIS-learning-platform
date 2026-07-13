import { Router } from 'express';
import { CourseController } from './courses.controller';
import { optionalAuthenticate } from '../../middleware/optionalAuthenticate';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { courseSlugParamsSchema, listCoursesQuerySchema } from './courses.validators';

const router = Router();
const controller = new CourseController();

/**
 * @openapi
 * /courses:
 *   get:
 *     tags: [Courses]
 *     summary: Browse published courses
 *     parameters:
 *       - in: query
 *         name: boardId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: classGradeId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: subjectId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Case-insensitive title search
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated list of published courses }
 */
router.get('/', validate({ query: listCoursesQuerySchema }), asyncHandler(controller.list));

/**
 * @openapi
 * /courses/{slug}:
 *   get:
 *     tags: [Courses]
 *     summary: Course detail with full syllabus
 *     description: >
 *       Public — works for anonymous visitors, who see the full syllabus
 *       structure (titles/order/duration) but no enrollment or progress
 *       data. If the request carries a valid access token for a STUDENT
 *       who is enrolled, the response additionally includes `isEnrolled`
 *       and per-lecture progress. Never returns a signed video/note URL —
 *       see GET /lectures/{id}/stream-url and GET /notes/{id}/download-url.
 *     security:
 *       - {}
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Course detail with nested chapters/modules/lectures/notes }
 *       404: { description: Course not found or not published }
 */
router.get(
  '/:slug',
  optionalAuthenticate,
  validate({ params: courseSlugParamsSchema }),
  asyncHandler(controller.detail),
);

export { router as coursesRouter };
