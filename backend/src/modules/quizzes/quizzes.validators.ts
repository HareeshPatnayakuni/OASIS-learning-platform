import { z } from 'zod';

const questionOptionSchema = z.object({
  text: z.string().trim().min(1).max(500),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  options: z.array(questionOptionSchema).min(2).max(10),
});

export const createQuizBodySchema = z.object({
  title: z.string().trim().min(2).max(200),
  passPercent: z.number().int().min(0).max(100).optional(),
  questions: z.array(questionSchema).min(1).max(100),
});
export type CreateQuizBody = z.infer<typeof createQuizBodySchema>;

export const updateQuizBodySchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    passPercent: z.number().int().min(0).max(100).optional(),
    questions: z.array(questionSchema).min(1).max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdateQuizBody = z.infer<typeof updateQuizBodySchema>;

export const moduleIdNestedParamsSchema = z.object({ moduleId: z.string().uuid() });
export const quizIdParamsSchema = z.object({ id: z.string().uuid() });
