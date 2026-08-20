import { z } from 'zod';

export const answerEvaluationResultSchema = z.object({
  suggestedMarks: z.number().min(0),
  criteria: z.array(z.object({
    criterion: z.string().min(1),
    awardedMarks: z.number().min(0),
    maxMarks: z.number().min(0),
    status: z.enum(['MET', 'PARTIAL', 'NOT_MET']),
  })),
  feedback: z.string().min(1),
  reasoning: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export type AnswerEvaluationResult = z.infer<typeof answerEvaluationResultSchema>;
