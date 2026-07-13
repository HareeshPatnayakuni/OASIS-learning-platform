import { Router } from 'express';
import { SearchController } from './search.controller';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { searchQuerySchema } from './search.validators';

const router = Router();
const controller = new SearchController();

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Search published courses, chapters, and modules by title
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "Matching courses, chapters, and modules (up to 10 each), scoped to published content" }
 */
router.get('/', validate({ query: searchQuerySchema }), asyncHandler(controller.search));

export { router as searchRouter };
