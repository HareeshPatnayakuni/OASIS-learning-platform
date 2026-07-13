import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'q is required').max(200),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
