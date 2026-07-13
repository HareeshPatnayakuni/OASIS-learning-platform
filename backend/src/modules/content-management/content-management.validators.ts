import { z } from 'zod';

// ── Params ───────────────────────────────────────────────────────────
export const courseIdParamsSchema = z.object({ courseId: z.string().uuid() });
export const chapterIdParamsSchema = z.object({ id: z.string().uuid() });
export const chapterIdNestedParamsSchema = z.object({ chapterId: z.string().uuid() });
export const moduleIdParamsSchema = z.object({ id: z.string().uuid() });
export const moduleIdNestedParamsSchema = z.object({ moduleId: z.string().uuid() });
export const lectureIdParamsSchema = z.object({ id: z.string().uuid() });
export const noteIdParamsSchema = z.object({ id: z.string().uuid() });

// ── Chapters ─────────────────────────────────────────────────────────
export const createChapterBodySchema = z.object({ title: z.string().trim().min(2).max(200) });
export type CreateChapterBody = z.infer<typeof createChapterBodySchema>;

export const updateChapterBodySchema = z
  .object({ title: z.string().trim().min(2).max(200).optional() })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdateChapterBody = z.infer<typeof updateChapterBodySchema>;

// ── Content Modules ──────────────────────────────────────────────────
export const createContentModuleBodySchema = z.object({ title: z.string().trim().min(2).max(200) });
export type CreateContentModuleBody = z.infer<typeof createContentModuleBodySchema>;

export const updateContentModuleBodySchema = z
  .object({ title: z.string().trim().min(2).max(200).optional() })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdateContentModuleBody = z.infer<typeof updateContentModuleBodySchema>;

// ── Lectures ─────────────────────────────────────────────────────────
export const createLectureBodySchema = z.object({
  title: z.string().trim().min(2).max(200),
  durationSec: z.number().int().positive().optional(),
  contentType: z.enum(['video/mp4', 'video/webm', 'video/quicktime']),
});
export type CreateLectureBody = z.infer<typeof createLectureBodySchema>;

export const updateLectureBodySchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    durationSec: z.number().int().positive().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdateLectureBody = z.infer<typeof updateLectureBodySchema>;

export const updateLectureStatusBodySchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']),
});
export type UpdateLectureStatusBody = z.infer<typeof updateLectureStatusBodySchema>;

export const reuploadBodySchema = z.object({
  contentType: z.string().min(1),
});
export type ReuploadBody = z.infer<typeof reuploadBodySchema>;

// ── Notes ────────────────────────────────────────────────────────────
export const createNoteBodySchema = z.object({
  title: z.string().trim().min(2).max(200),
  contentType: z.literal('application/pdf'),
});
export type CreateNoteBody = z.infer<typeof createNoteBodySchema>;

export const updateNoteBodySchema = z
  .object({ title: z.string().trim().min(2).max(200).optional() })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdateNoteBody = z.infer<typeof updateNoteBodySchema>;

// ── Shared: move up/down ────────────────────────────────────────────
export const moveBodySchema = z.object({ direction: z.enum(['up', 'down']) });
export type MoveBody = z.infer<typeof moveBodySchema>;
