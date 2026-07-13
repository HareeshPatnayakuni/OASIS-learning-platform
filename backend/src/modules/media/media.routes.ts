import { Router } from 'express';
import { MediaController } from './media.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createMediaBodySchema, mediaIdParamsSchema } from './media.validators';

const router = Router();
const controller = new MediaController();

// Module 3C addendum: ADMIN was added alongside TEACHER on both routes
// below so Platform Settings (docs/10-module-3c-notes.md) can upload an
// academy logo/favicon through this same pipeline — MediaPurposeValue
// already had ACADEMY_LOGO/GENERIC cases reserved for exactly this,
// per Module 3B's PROJECT_MEMORY.md note. Everything else in this file
// (ownership-on-delete, content-type validation, TTLs) is unchanged.

/**
 * @openapi
 * /media:
 *   post:
 *     tags: [Media]
 *     summary: Start an image upload (course thumbnail, etc.) — returns a signed R2 PUT URL
 *     description: >
 *       The browser uploads the image bytes directly to the returned
 *       `uploadUrl` (PUT request, body = raw file, no auth header needed —
 *       the URL itself is the credential). This endpoint never touches the
 *       image bytes; the Express server only issues the URL.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [purpose, contentType]
 *             properties:
 *               purpose: { type: string, enum: [COURSE_THUMBNAIL, TEACHER_AVATAR, TESTIMONIAL_PHOTO, ACADEMY_LOGO, GENERIC] }
 *               contentType: { type: string, example: image/jpeg }
 *     responses:
 *       201: { description: "Media row created; upload URL issued" }
 *       400: { description: Unsupported content type }
 */
router.post(
  '/',
  authenticate,
  requireRole('TEACHER', 'ADMIN'),
  validate({ body: createMediaBodySchema }),
  asyncHandler(controller.create),
);

/**
 * @openapi
 * /media/{id}:
 *   delete:
 *     tags: [Media]
 *     summary: Delete an image (only the uploader may delete it)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       403: { description: Not the uploader }
 *       404: { description: Not found }
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('TEACHER', 'ADMIN'),
  validate({ params: mediaIdParamsSchema }),
  asyncHandler(controller.remove),
);

export { router as mediaRouter };
