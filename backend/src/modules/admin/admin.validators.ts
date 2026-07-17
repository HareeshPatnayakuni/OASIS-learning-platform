import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '../../config/constants';

// ── Shared ───────────────────────────────────────────────────────────
export const idParamsSchema = z.object({ id: z.string().uuid() });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const searchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
});

// ── Teachers ─────────────────────────────────────────────────────────
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const createTeacherBodySchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  phone: z.string().trim().min(6).max(20).optional(),
});
export type CreateTeacherBody = z.infer<typeof createTeacherBodySchema>;

export const updateTeacherBodySchema = z
  .object({
    fullName: z.string().trim().min(2).max(200).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().min(6).max(20).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdateTeacherBody = z.infer<typeof updateTeacherBodySchema>;

export const setActiveBodySchema = z.object({ isActive: z.boolean() });
export type SetActiveBody = z.infer<typeof setActiveBodySchema>;

// ── Courses ──────────────────────────────────────────────────────────
export const courseSearchQuerySchema = searchQuerySchema.extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});
export type CourseSearchQuery = z.infer<typeof courseSearchQuerySchema>;

// ── Payments (Module 4B) ─────────────────────────────────────────────
export const paymentSearchQuerySchema = paginationQuerySchema.extend({
  student: z.string().trim().min(1).optional(),
  course: z.string().trim().min(1).optional(),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']).optional(),
});
export type PaymentSearchQuery = z.infer<typeof paymentSearchQuerySchema>;

// ── Platform announcements ───────────────────────────────────────────
export const createPlatformAnnouncementBodySchema = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(1).max(5000),
});
export type CreatePlatformAnnouncementBody = z.infer<typeof createPlatformAnnouncementBodySchema>;

export const updatePlatformAnnouncementBodySchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    body: z.string().trim().min(1).max(5000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdatePlatformAnnouncementBody = z.infer<typeof updatePlatformAnnouncementBodySchema>;

// ── Platform settings ────────────────────────────────────────────────
const socialLinksSchema = z.record(z.string(), z.string().url()).optional();

export const updateSettingsBodySchema = z
  .object({
    academyName: z.string().trim().min(1).max(200).optional(),
    academyFullName: z.string().trim().min(1).max(300).nullable().optional(),
    tagline: z.string().trim().max(300).nullable().optional(),
    contactEmail: z.string().trim().toLowerCase().email().optional(),
    contactPhone: z.string().trim().min(6).max(20).nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    socialLinks: socialLinksSchema.nullable(),
    logoId: z.string().uuid().nullable().optional(),
    faviconId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdateSettingsBody = z.infer<typeof updateSettingsBodySchema>;
