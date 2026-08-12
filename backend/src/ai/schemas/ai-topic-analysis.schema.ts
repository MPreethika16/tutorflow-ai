import { z } from 'zod';

export const aiTopicAnalysisSchema = z.object({
  topic: z.string().min(1),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  summary: z.string().min(1),
});

export type AiTopicAnalysis = z.infer<
  typeof aiTopicAnalysisSchema
>;