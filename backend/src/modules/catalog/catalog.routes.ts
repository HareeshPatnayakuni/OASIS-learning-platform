import { Router } from 'express';
import { CatalogController } from './catalog.controller';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();
const controller = new CatalogController();

/**
 * @openapi
 * /boards:
 *   get:
 *     tags: [Catalog]
 *     summary: List curriculum Boards (CBSE, ICSE, State Boards, ...)
 *     responses:
 *       200: { description: List of boards }
 */
router.get('/boards', asyncHandler(controller.listBoards));

/**
 * @openapi
 * /class-grades:
 *   get:
 *     tags: [Catalog]
 *     summary: List Class Grades (4–10)
 *     responses:
 *       200: { description: List of class grades, ordered 4 to 10 }
 */
router.get('/class-grades', asyncHandler(controller.listClassGrades));

/**
 * @openapi
 * /subjects:
 *   get:
 *     tags: [Catalog]
 *     summary: List Subjects
 *     responses:
 *       200: { description: List of subjects }
 */
router.get('/subjects', asyncHandler(controller.listSubjects));

export { router as catalogRouter };
