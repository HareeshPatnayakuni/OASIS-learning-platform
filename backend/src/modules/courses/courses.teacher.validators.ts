import { z } from 'zod';

const priceSchema = z.number().nonnegative().finite();

export const createCourseBodySchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  boardId: z.string().uuid(),
  classGradeId: z.string().uuid(),
  subjectId: z.string().uuid(),
  price: priceSchema,
  discountPrice: priceSchema.nullable().optional(),
});
export type CreateCourseBody = z.infer<typeof createCourseBodySchema>;

export const updateCourseBodySchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    boardId: z.string().uuid().optional(),
    classGradeId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    price: priceSchema.optional(),
    discountPrice: priceSchema.nullable().optional(),
    thumbnailId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdateCourseBody = z.infer<typeof updateCourseBodySchema>;

export const updateCourseStatusBodySchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
});
export type UpdateCourseStatusBody = z.infer<typeof updateCourseStatusBodySchema>;

export const courseIdParamsSchema = z.object({ id: z.string().uuid() });
export type CourseIdParams = z.infer<typeof courseIdParamsSchema>;
