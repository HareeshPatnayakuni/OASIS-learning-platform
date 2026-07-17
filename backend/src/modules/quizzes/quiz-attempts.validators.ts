import { z } from 'zod';

export const quizIdNestedParamsSchema = z.object({ quizId: z.string().uuid() });
export type QuizIdNestedParams = z.infer<typeof quizIdNestedParamsSchema>;

const submittedAnswerSchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid(),
});

export const submitAnswersBodySchema = z.object({
  answers: z.array(submittedAnswerSchema).min(1).max(200),
});
export type SubmitAnswersBody = z.infer<typeof submitAnswersBodySchema>;
