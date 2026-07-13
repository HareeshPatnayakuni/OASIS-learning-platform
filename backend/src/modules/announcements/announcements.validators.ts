import { z } from 'zod';

export const courseIdParamsSchema = z.object({ courseId: z.string().uuid() });
export const announcementIdParamsSchema = z.object({ id: z.string().uuid() });

export const createAnnouncementBodySchema = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(1).max(5000),
});
export type CreateAnnouncementBody = z.infer<typeof createAnnouncementBodySchema>;

export const updateAnnouncementBodySchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    body: z.string().trim().min(1).max(5000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdateAnnouncementBody = z.infer<typeof updateAnnouncementBodySchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
