import { z } from 'zod';

import {
  generatedQuestionSchema,
 
} from './generated-question.schema';

export const generatedPaperSchema = z
  .object({
    title: z.string().min(3).max(150),

    instructions: z
      .array(z.string().min(1))
      .min(1),

    durationMinutes: z
      .number()
      .int()
      .min(1),

    totalMarks: z
      .number()
      .int()
      .min(1),

    questions: z
      .array(generatedQuestionSchema)
      .min(1),
  })
  .superRefine((paper, ctx) => {
    const calculatedMarks =
      paper.questions.reduce(
        (sum, question) =>
          sum + question.marks,
        0,
      );

    if (
      calculatedMarks !==
      paper.totalMarks
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['totalMarks'],
        message:
          'totalMarks must equal the sum of question marks',
      });
    }

    for (const question of paper.questions) {
      if (question.type === 'MCQ') {
        const optionIds =
          question.options.map(
            (option) => option.id,
          );

        if (
          !optionIds.includes(
            question.correctOption,
          )
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['questions'],
            message:
              'MCQ correctOption must match one of the option ids',
          });
        }
      }
    }
  });

export type GeneratedPaper =
  z.infer<
    typeof generatedPaperSchema
  >;