import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '../../config/constants';

/** Shared password rule: FR-AUTH-1 / NFR-SEC-2 territory — strong enough to
 * matter, not so strict it drives students to write it on a sticky note.
 * At least one letter and one number, minimum length from constants.ts. */
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const emailSchema = z.string().trim().toLowerCase().email('Must be a valid email address');

const deviceIdSchema = z
  .string()
  .min(8, 'deviceId must be a stable client-generated identifier')
  .max(200);

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(200),
  email: emailSchema,
  password: passwordSchema,
  // FR-AUTH-1 / FR-CAT-2 — optional "target class/board" at registration.
  // See docs/07-module-2-notes.md for why these are nullable FKs on User.
  classGradeId: z.string().uuid().optional(),
  boardId: z.string().uuid().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  deviceId: deviceIdSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
  deviceId: deviceIdSchema,
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});
export type LogoutInput = z.infer<typeof logoutSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'token is required'),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'token is required'),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: emailSchema,
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
