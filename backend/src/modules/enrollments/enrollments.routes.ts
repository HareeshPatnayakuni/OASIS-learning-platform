import { Router } from 'express';
import { EnrollmentController } from './enrollments.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();
const controller = new EnrollmentController();

/**
 * @openapi
 * /enrollments/me:
 *   get:
 *     tags: [Enrollments]
 *     summary: My enrolled courses ("My Courses" / "Purchased Courses"), with progress
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of enrolled courses with computed progress percentage }
 */
router.get('/me', authenticate, requireRole('STUDENT'), asyncHandler(controller.listMyCourses));

export { router as enrollmentsRouter };
