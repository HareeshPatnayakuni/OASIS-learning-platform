import { z } from 'zod';

export const listCoursesQuerySchema = z.object({
  boardId: z.string().uuid().optional(),
  classGradeId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;

export const courseSlugParamsSchema = z.object({
  slug: z.string().min(1),
});
export type CourseSlugParams = z.infer<typeof courseSlugParamsSchema>;
