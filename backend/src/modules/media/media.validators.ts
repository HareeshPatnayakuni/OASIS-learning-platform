import { z } from 'zod';

export const mediaPurposeEnum = z.enum([
  'COURSE_THUMBNAIL',
  'TEACHER_AVATAR',
  'TESTIMONIAL_PHOTO',
  'ACADEMY_LOGO',
  'GENERIC',
]);

export const createMediaBodySchema = z.object({
  purpose: mediaPurposeEnum,
  contentType: z.string().min(1),
});
export type CreateMediaBody = z.infer<typeof createMediaBodySchema>;

export const mediaIdParamsSchema = z.object({ id: z.string().uuid() });
export type MediaIdParams = z.infer<typeof mediaIdParamsSchema>;
