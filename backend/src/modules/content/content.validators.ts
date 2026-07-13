import { z } from 'zod';

export const lectureIdParamsSchema = z.object({ id: z.string().uuid() });
export type LectureIdParams = z.infer<typeof lectureIdParamsSchema>;

export const noteIdParamsSchema = z.object({ id: z.string().uuid() });
export type NoteIdParams = z.infer<typeof noteIdParamsSchema>;

export const updateProgressBodySchema = z
  .object({
    lastPositionSec: z.number().int().nonnegative().optional(),
    isCompleted: z.boolean().optional(),
  })
  .refine((data) => data.lastPositionSec !== undefined || data.isCompleted !== undefined, {
    message: 'At least one of lastPositionSec or isCompleted must be provided',
  });
export type UpdateProgressBody = z.infer<typeof updateProgressBodySchema>;
