import { z } from 'zod';

export const BatchLLMResultSchema = z.object({
  overallSummary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
  communication: z.string().optional(),
});
