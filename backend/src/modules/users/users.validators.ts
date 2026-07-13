import { z } from 'zod';

export const updateProfileBodySchema = z
  .object({
    fullName: z.string().trim().min(2).max(200).optional(),
    phone: z.string().trim().min(7).max(20).nullable().optional(),
    classGradeId: z.string().uuid().nullable().optional(),
    boardId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
