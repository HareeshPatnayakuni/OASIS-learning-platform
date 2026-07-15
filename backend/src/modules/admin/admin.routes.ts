import { Router } from 'express';
import { AdminController } from './admin.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  courseSearchQuerySchema,
  createPlatformAnnouncementBodySchema,
  createTeacherBodySchema,
  idParamsSchema,
  paginationQuerySchema,
  searchQuerySchema,
  setActiveBodySchema,
  updatePlatformAnnouncementBodySchema,
  updateSettingsBodySchema,
  updateTeacherBodySchema,
} from './admin.validators';

const router = Router();
const controller = new AdminController();

/**
 * Every route in this file except the one explicitly marked PUBLIC below
 * requires ADMIN (or SUPER_ADMIN — a super-admin can do anything a plain
 * admin can; see docs/10-module-3c-notes.md for why both roles are
 * accepted even though the brief says "Only ADMIN users"). Mounted at
 * /api/v1 root (not /api/v1/admin) so the one public route
 * (`/announcements/platform`) doesn't have to live under an /admin/ path
 * it has no business being under — every other route below spells out
 * `/admin/...` explicitly instead.
 */
const adminOnly = [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')] as const;

// ═══════════════════════════ Dashboard / Analytics ═══════════════════

/**
 * @openapi
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Admin Dashboard home — counts, recent registrations, recent announcements
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard stats }
 */
router.get('/admin/dashboard', ...adminOnly, asyncHandler(controller.getDashboard));

/**
 * @openapi
 * /admin/analytics:
 *   get:
 *     tags: [Admin]
 *     summary: Basic platform analytics (counts only — no charts, no reports)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Analytics stats }
 */
router.get('/admin/analytics', ...adminOnly, asyncHandler(controller.getAnalytics));

// ═══════════════════════════════ Teachers ═════════════════════════════

/**
 * @openapi
 * /admin/teachers:
 *   get:
 *     tags: [Admin]
 *     summary: List/search teachers
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated teacher list }
 *   post:
 *     tags: [Admin]
 *     summary: Add a teacher account
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               phone: { type: string }
 *     responses:
 *       201: { description: Teacher created }
 *       400: { description: Email already in use }
 */
router.get('/admin/teachers', ...adminOnly, validate({ query: searchQuerySchema }), asyncHandler(controller.listTeachers));
router.post(
  '/admin/teachers',
  ...adminOnly,
  validate({ body: createTeacherBodySchema }),
  asyncHandler(controller.createTeacher),
);

/**
 * @openapi
 * /admin/teachers/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Edit teacher details (not their course content — that stays Teacher-owned)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { fullName: { type: string }, email: { type: string }, phone: { type: string, nullable: true } }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Teacher not found }
 */
router.patch(
  '/admin/teachers/:id',
  ...adminOnly,
  validate({ params: idParamsSchema, body: updateTeacherBodySchema }),
  asyncHandler(controller.updateTeacher),
);

/**
 * @openapi
 * /admin/teachers/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Disable or enable a teacher account
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [isActive], properties: { isActive: { type: boolean } } }
 *     responses:
 *       200: { description: Updated }
 */
router.patch(
  '/admin/teachers/:id/status',
  ...adminOnly,
  validate({ params: idParamsSchema, body: setActiveBodySchema }),
  asyncHandler(controller.setTeacherActive),
);

/**
 * @openapi
 * /admin/teachers/{id}/reset-password:
 *   post:
 *     tags: [Admin]
 *     summary: Send a password-reset email to a teacher (reuses the same flow as self-service "forgot password")
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Reset email sent (if the account exists) }
 */
router.post(
  '/admin/teachers/:id/reset-password',
  ...adminOnly,
  validate({ params: idParamsSchema }),
  asyncHandler(controller.resetTeacherPassword),
);

// ═══════════════════════════════ Students ═════════════════════════════

/**
 * @openapi
 * /admin/students:
 *   get:
 *     tags: [Admin]
 *     summary: List/search students
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated student list }
 */
router.get('/admin/students', ...adminOnly, validate({ query: searchQuerySchema }), asyncHandler(controller.listStudents));

/**
 * @openapi
 * /admin/students/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Disable or enable a student account
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [isActive], properties: { isActive: { type: boolean } } }
 *     responses:
 *       200: { description: Updated }
 */
router.patch(
  '/admin/students/:id/status',
  ...adminOnly,
  validate({ params: idParamsSchema, body: setActiveBodySchema }),
  asyncHandler(controller.setStudentActive),
);

/**
 * @openapi
 * /admin/students/{id}/reset-password:
 *   post:
 *     tags: [Admin]
 *     summary: Send a password-reset email to a student
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Reset email sent (if the account exists) }
 */
router.post(
  '/admin/students/:id/reset-password',
  ...adminOnly,
  validate({ params: idParamsSchema }),
  asyncHandler(controller.resetStudentPassword),
);

// ═══════════════════════════ Course oversight ═════════════════════════

/**
 * @openapi
 * /admin/courses:
 *   get:
 *     tags: [Admin]
 *     summary: "View all courses, any status, with owning teacher (read-only oversight)"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated course list }
 */
router.get(
  '/admin/courses',
  ...adminOnly,
  validate({ query: courseSearchQuerySchema }),
  asyncHandler(controller.listCourses),
);

/**
 * @openapi
 * /admin/courses/{id}/archive:
 *   patch:
 *     tags: [Admin]
 *     summary: Archive a course (removes it from public visibility — never Draft/Publish directly, that's a Teacher content decision)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Course archived }
 *       404: { description: Course not found }
 */
router.patch(
  '/admin/courses/:id/archive',
  ...adminOnly,
  validate({ params: idParamsSchema }),
  asyncHandler(controller.archiveCourse),
);

/**
 * @openapi
 * /admin/courses/{id}/restore:
 *   patch:
 *     tags: [Admin]
 *     summary: Restore an archived course back to Draft (the Teacher then chooses when to Publish again via their own existing action — restoring never republishes automatically)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Course restored to Draft }
 *       400: { description: Course is not currently archived }
 *       404: { description: Course not found }
 */
router.patch(
  '/admin/courses/:id/restore',
  ...adminOnly,
  validate({ params: idParamsSchema }),
  asyncHandler(controller.restoreCourse),
);

/**
 * @openapi
 * /admin/courses/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a course (soft delete). Frontend must confirm before calling this — irreversible from the user's perspective.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Course not found }
 */
router.delete(
  '/admin/courses/:id',
  ...adminOnly,
  validate({ params: idParamsSchema }),
  asyncHandler(controller.deleteCourse),
);

// ═══════════════════════ Platform-wide announcements ═══════════════════

/**
 * @openapi
 * /admin/announcements:
 *   get:
 *     tags: [Admin]
 *     summary: List platform-wide announcements (Admin's own management view)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated list }
 *   post:
 *     tags: [Admin]
 *     summary: Create a platform-wide announcement, visible to every user
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [title, body], properties: { title: { type: string }, body: { type: string } } }
 *     responses:
 *       201: { description: Created }
 */
router.get(
  '/admin/announcements',
  ...adminOnly,
  validate({ query: paginationQuerySchema }),
  asyncHandler(controller.listAnnouncements),
);
router.post(
  '/admin/announcements',
  ...adminOnly,
  validate({ body: createPlatformAnnouncementBodySchema }),
  asyncHandler(controller.createAnnouncement),
);

/**
 * @openapi
 * /admin/announcements/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Edit a platform-wide announcement
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
 *     tags: [Admin]
 *     summary: Delete a platform-wide announcement
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       204: { description: Deleted }
 */
router.patch(
  '/admin/announcements/:id',
  ...adminOnly,
  validate({ params: idParamsSchema, body: updatePlatformAnnouncementBodySchema }),
  asyncHandler(controller.updateAnnouncement),
);
router.delete(
  '/admin/announcements/:id',
  ...adminOnly,
  validate({ params: idParamsSchema }),
  asyncHandler(controller.deleteAnnouncement),
);

/**
 * @openapi
 * /announcements/platform:
 *   get:
 *     tags: [Admin]
 *     summary: "PUBLIC: platform-wide announcements for display to any visitor"
 *     description: >
 *       The one route in this file that is NOT admin-only — "these
 *       announcements appear to every user" (including logged-out
 *       visitors) is the whole point of a platform-wide announcement.
 *     responses:
 *       200: { description: Recent platform announcements }
 */
router.get(
  '/announcements/platform',
  validate({ query: paginationQuerySchema }),
  asyncHandler(controller.listAnnouncements),
);

/**
 * @openapi
 * /settings:
 *   get:
 *     tags: [Admin]
 *     summary: "PUBLIC: platform branding/contact settings for site-wide display"
 *     description: >
 *       The frontend's Navbar, page title, and Home page read academy
 *       name/tagline/logo/favicon/contact info from here, rather than
 *       hardcoding them — this is the public counterpart to
 *       GET /admin/settings (same data, no auth required). Only
 *       public-facing branding/contact fields are ever stored on
 *       AcademySettings in the first place; nothing here is sensitive.
 *     responses:
 *       200: { description: Current public settings }
 */
router.get('/settings', asyncHandler(controller.getPublicSettings));

// ═══════════════════════════ Platform settings ═════════════════════════

/**
 * @openapi
 * /admin/settings:
 *   get:
 *     tags: [Admin]
 *     summary: Get platform settings
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current settings }
 *   patch:
 *     tags: [Admin]
 *     summary: Update platform settings
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               academyName: { type: string }
 *               academyFullName: { type: string, nullable: true }
 *               tagline: { type: string, nullable: true }
 *               contactEmail: { type: string }
 *               contactPhone: { type: string, nullable: true }
 *               address: { type: string, nullable: true }
 *               socialLinks: { type: object, nullable: true, additionalProperties: { type: string } }
 *               logoId: { type: string, format: uuid, nullable: true, description: "Media ID from POST /media (purpose=ACADEMY_LOGO)" }
 *               faviconId: { type: string, format: uuid, nullable: true, description: "Media ID from POST /media (purpose=GENERIC)" }
 *     responses:
 *       200: { description: Updated settings }
 */
router.get('/admin/settings', ...adminOnly, asyncHandler(controller.getSettings));
router.patch(
  '/admin/settings',
  ...adminOnly,
  validate({ body: updateSettingsBodySchema }),
  asyncHandler(controller.updateSettings),
);

export { router as adminRouter };
