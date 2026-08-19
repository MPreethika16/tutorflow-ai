import { z } from 'zod';

export const answerEvaluationResultSchema = z.object({
  suggestedMarks: z.number().min(0),
  feedback: z.string().min(1),
  reasoning: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export type AnswerEvaluationResult = z.infer<typeof answerEvaluationResultSchema>;
