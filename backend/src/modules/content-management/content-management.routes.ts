import { Router } from 'express';
import { ContentManagementController } from './content-management.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  chapterIdNestedParamsSchema,
  chapterIdParamsSchema,
  courseIdParamsSchema,
  createChapterBodySchema,
  createContentModuleBodySchema,
  createLectureBodySchema,
  createNoteBodySchema,
  lectureIdParamsSchema,
  moduleIdNestedParamsSchema,
  moduleIdParamsSchema,
  moveBodySchema,
  noteIdParamsSchema,
  reuploadBodySchema,
  updateChapterBodySchema,
  updateContentModuleBodySchema,
  updateLectureBodySchema,
  updateLectureStatusBodySchema,
  updateNoteBodySchema,
} from './content-management.validators';

const router = Router();
const controller = new ContentManagementController();
const teacherOnly = [authenticate, requireRole('TEACHER')] as const;

/**
 * @openapi
 * /courses/{id}/content:
 *   get:
 *     tags: [Content Management]
 *     summary: "Course Builder: full content tree for a course you own"
 *     description: >
 *       Unlike the public GET /courses/{slug} (Module 3A), this returns
 *       lectures of EVERY status (DRAFT/PUBLISHED/HIDDEN), plus notes and
 *       quiz summaries — everything a teacher needs to manage their
 *       course, not just what students should currently see.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: "Full chapter -> module -> lectures/notes/quizzes tree" }
 *       403: { description: You do not own this course }
 */
router.get(
  '/courses/:id/content',
  ...teacherOnly,
  validate({ params: chapterIdParamsSchema }), // reuses the { id: uuid } shape
  asyncHandler(controller.getContentTree),
);

// ═════════════════════════════ Chapters ═════════════════════════════

/**
 * @openapi
 * /courses/{courseId}/chapters:
 *   post:
 *     tags: [Content Management]
 *     summary: Create a chapter in a course you own
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [title], properties: { title: { type: string } } }
 *     responses:
 *       201: { description: Chapter created (appended to the end) }
 */
router.post(
  '/courses/:courseId/chapters',
  ...teacherOnly,
  validate({ params: courseIdParamsSchema, body: createChapterBodySchema }),
  asyncHandler(controller.createChapter),
);

/**
 * @openapi
 * /chapters/{id}:
 *   patch:
 *     tags: [Content Management]
 *     summary: Edit a chapter
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { title: { type: string } } }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Content Management]
 *     summary: Delete a chapter (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       204: { description: Deleted }
 */
router.patch(
  '/chapters/:id',
  ...teacherOnly,
  validate({ params: chapterIdParamsSchema, body: updateChapterBodySchema }),
  asyncHandler(controller.updateChapter),
);
router.delete(
  '/chapters/:id',
  ...teacherOnly,
  validate({ params: chapterIdParamsSchema }),
  asyncHandler(controller.deleteChapter),
);

/**
 * @openapi
 * /chapters/{id}/move:
 *   patch:
 *     tags: [Content Management]
 *     summary: Move a chapter up or down (swaps order with the adjacent sibling)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [direction], properties: { direction: { type: string, enum: [up, down] } } }
 *     responses:
 *       204: { description: Reordered }
 *       400: { description: Already first/last }
 */
router.patch(
  '/chapters/:id/move',
  ...teacherOnly,
  validate({ params: chapterIdParamsSchema, body: moveBodySchema }),
  asyncHandler(controller.moveChapter),
);

// ═══════════════════════════ Content Modules ═══════════════════════

/**
 * @openapi
 * /chapters/{chapterId}/modules:
 *   post:
 *     tags: [Content Management]
 *     summary: Create a module in a chapter you own
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: chapterId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [title], properties: { title: { type: string } } }
 *     responses:
 *       201: { description: Module created }
 */
router.post(
  '/chapters/:chapterId/modules',
  ...teacherOnly,
  validate({ params: chapterIdNestedParamsSchema, body: createContentModuleBodySchema }),
  asyncHandler(controller.createContentModule),
);

/**
 * @openapi
 * /modules/{id}:
 *   patch:
 *     tags: [Content Management]
 *     summary: Edit a module
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { title: { type: string } } }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Content Management]
 *     summary: Delete a module (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       204: { description: Deleted }
 */
router.patch(
  '/modules/:id',
  ...teacherOnly,
  validate({ params: moduleIdParamsSchema, body: updateContentModuleBodySchema }),
  asyncHandler(controller.updateContentModule),
);
router.delete(
  '/modules/:id',
  ...teacherOnly,
  validate({ params: moduleIdParamsSchema }),
  asyncHandler(controller.deleteContentModule),
);

/**
 * @openapi
 * /modules/{id}/move:
 *   patch:
 *     tags: [Content Management]
 *     summary: Move a module up or down within its chapter
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [direction], properties: { direction: { type: string, enum: [up, down] } } }
 *     responses:
 *       204: { description: Reordered }
 */
router.patch(
  '/modules/:id/move',
  ...teacherOnly,
  validate({ params: moduleIdParamsSchema, body: moveBodySchema }),
  asyncHandler(controller.moveContentModule),
);

// ═══════════════════════════════ Lectures ═══════════════════════════

/**
 * @openapi
 * /modules/{moduleId}/lectures:
 *   post:
 *     tags: [Content Management]
 *     summary: Create a lecture and get a signed upload URL for its video
 *     description: >
 *       Creates the Lecture row (status starts DRAFT) with a
 *       server-generated object key, and returns a signed R2 PUT URL for
 *       that key in the same response — upload the video file directly to
 *       `uploadUrl` right after. Same direct-to-R2 pattern as Module 3A's
 *       signed download URLs, just PUT instead of GET.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: moduleId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, contentType]
 *             properties:
 *               title: { type: string }
 *               durationSec: { type: integer }
 *               contentType: { type: string, enum: [video/mp4, video/webm, video/quicktime] }
 *     responses:
 *       201: { description: Lecture created; upload URL issued }
 */
router.post(
  '/modules/:moduleId/lectures',
  ...teacherOnly,
  validate({ params: moduleIdNestedParamsSchema, body: createLectureBodySchema }),
  asyncHandler(controller.createLecture),
);

/**
 * @openapi
 * /lectures/{id}/reupload-url:
 *   post:
 *     tags: [Content Management]
 *     summary: Get a fresh signed upload URL to replace an existing lecture's video
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [contentType], properties: { contentType: { type: string } } }
 *     responses:
 *       200: { description: Upload URL issued for the lecture's existing object key }
 */
router.post(
  '/lectures/:id/reupload-url',
  ...teacherOnly,
  validate({ params: lectureIdParamsSchema, body: reuploadBodySchema }),
  asyncHandler(controller.reuploadLectureVideo),
);

/**
 * @openapi
 * /lectures/{id}:
 *   patch:
 *     tags: [Content Management]
 *     summary: Edit lecture title/duration
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { title: { type: string }, durationSec: { type: integer, nullable: true } } }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Content Management]
 *     summary: Delete a lecture (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       204: { description: Deleted }
 */
router.patch(
  '/lectures/:id',
  ...teacherOnly,
  validate({ params: lectureIdParamsSchema, body: updateLectureBodySchema }),
  asyncHandler(controller.updateLecture),
);
router.delete(
  '/lectures/:id',
  ...teacherOnly,
  validate({ params: lectureIdParamsSchema }),
  asyncHandler(controller.deleteLecture),
);

/**
 * @openapi
 * /lectures/{id}/status:
 *   patch:
 *     tags: [Content Management]
 *     summary: Set lecture status (Draft / Published / Hidden)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [status], properties: { status: { type: string, enum: [DRAFT, PUBLISHED, HIDDEN] } } }
 *     responses:
 *       200: { description: Status updated }
 */
router.patch(
  '/lectures/:id/status',
  ...teacherOnly,
  validate({ params: lectureIdParamsSchema, body: updateLectureStatusBodySchema }),
  asyncHandler(controller.updateLectureStatus),
);

/**
 * @openapi
 * /lectures/{id}/move:
 *   patch:
 *     tags: [Content Management]
 *     summary: Move a lecture up or down within its module
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [direction], properties: { direction: { type: string, enum: [up, down] } } }
 *     responses:
 *       204: { description: Reordered }
 */
router.patch(
  '/lectures/:id/move',
  ...teacherOnly,
  validate({ params: lectureIdParamsSchema, body: moveBodySchema }),
  asyncHandler(controller.moveLecture),
);

// ═══════════════════════════════ Notes ═══════════════════════════════

/**
 * @openapi
 * /modules/{moduleId}/notes:
 *   post:
 *     tags: [Content Management]
 *     summary: Create a note and get a signed upload URL for its PDF
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: moduleId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, contentType]
 *             properties:
 *               title: { type: string }
 *               contentType: { type: string, enum: [application/pdf] }
 *     responses:
 *       201: { description: Note created; upload URL issued }
 */
router.post(
  '/modules/:moduleId/notes',
  ...teacherOnly,
  validate({ params: moduleIdNestedParamsSchema, body: createNoteBodySchema }),
  asyncHandler(controller.createNote),
);

/**
 * @openapi
 * /notes/{id}/reupload-url:
 *   post:
 *     tags: [Content Management]
 *     summary: Get a fresh signed upload URL to replace an existing note's PDF
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [contentType], properties: { contentType: { type: string } } }
 *     responses:
 *       200: { description: Upload URL issued }
 */
router.post(
  '/notes/:id/reupload-url',
  ...teacherOnly,
  validate({ params: noteIdParamsSchema, body: reuploadBodySchema }),
  asyncHandler(controller.reuploadNoteFile),
);

/**
 * @openapi
 * /notes/{id}:
 *   patch:
 *     tags: [Content Management]
 *     summary: Edit a note's title
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { title: { type: string } } }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Content Management]
 *     summary: Delete a note (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       204: { description: Deleted }
 */
router.patch(
  '/notes/:id',
  ...teacherOnly,
  validate({ params: noteIdParamsSchema, body: updateNoteBodySchema }),
  asyncHandler(controller.updateNote),
);
router.delete(
  '/notes/:id',
  ...teacherOnly,
  validate({ params: noteIdParamsSchema }),
  asyncHandler(controller.deleteNote),
);

export { router as contentManagementRouter };
