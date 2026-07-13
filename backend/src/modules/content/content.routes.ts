import { Router } from 'express';
import { ContentController } from './content.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { lectureIdParamsSchema, noteIdParamsSchema, updateProgressBodySchema } from './content.validators';

const router = Router();
const controller = new ContentController();

/**
 * @openapi
 * /lectures/{id}/stream-url:
 *   get:
 *     tags: [Content]
 *     summary: Issue a short-lived signed URL to stream a lecture video
 *     description: Requires enrollment in the lecture's parent course. The URL expires in 4 hours (long enough to cover a full viewing session, including seeking).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Signed URL issued }
 *       403: { description: Not enrolled in this course }
 *       404: { description: Lecture not found }
 */
router.get(
  '/lectures/:id/stream-url',
  authenticate,
  requireRole('STUDENT'),
  validate({ params: lectureIdParamsSchema }),
  asyncHandler(controller.getLectureStreamUrl),
);

/**
 * @openapi
 * /notes/{id}/download-url:
 *   get:
 *     tags: [Content]
 *     summary: Issue a short-lived signed URL to download a note PDF
 *     description: Requires enrollment in the note's parent course. The URL expires in 10 minutes.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Signed URL issued }
 *       403: { description: Not enrolled in this course }
 *       404: { description: Note not found }
 */
router.get(
  '/notes/:id/download-url',
  authenticate,
  requireRole('STUDENT'),
  validate({ params: noteIdParamsSchema }),
  asyncHandler(controller.getNoteDownloadUrl),
);

/**
 * @openapi
 * /lectures/{id}/progress:
 *   put:
 *     tags: [Content]
 *     summary: Update playback position and/or completion for a lecture
 *     description: >
 *       Requires enrollment. Also records today as an active day for the
 *       student's Learning Streak. At least one of lastPositionSec or
 *       isCompleted is required.
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
 *               lastPositionSec: { type: integer, minimum: 0 }
 *               isCompleted: { type: boolean }
 *     responses:
 *       200: { description: Progress updated }
 *       403: { description: Not enrolled in this course }
 *       404: { description: Lecture not found }
 */
router.put(
  '/lectures/:id/progress',
  authenticate,
  requireRole('STUDENT'),
  validate({ params: lectureIdParamsSchema, body: updateProgressBodySchema }),
  asyncHandler(controller.updateLectureProgress),
);

export { router as contentRouter };
