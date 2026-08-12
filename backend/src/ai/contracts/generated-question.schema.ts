import { z } from 'zod';

export const generatedQuestionDifficultySchema =
  z.enum([
    'EASY',
    'MEDIUM',
    'HARD',
  ]);

export const generatedQuestionTypeSchema =
  z.enum([
    'MCQ',
    'TRUE_FALSE',
    'FILL_BLANK',
    'SHORT_ANSWER',
    'LONG_ANSWER',
  ]);

const baseQuestionSchema = z.object({
  prompt: z.string().min(1),
  marks: z.number().int().min(1),
  difficulty:
    generatedQuestionDifficultySchema,
});

const mcqQuestionSchema =
  baseQuestionSchema.extend({
    type: z.literal('MCQ'),

    options: z
      .array(
        z.object({
          id: z.string().min(1),
          text: z.string().min(1),
        }),
      )
      .min(2),

    correctOption: z.string().min(1),

    explanation: z.string().min(1),
  });

const trueFalseQuestionSchema =
  baseQuestionSchema.extend({
    type: z.literal('TRUE_FALSE'),

    correctAnswer: z.boolean(),

    explanation: z.string().min(1),
  });

const fillBlankQuestionSchema =
  baseQuestionSchema.extend({
    type: z.literal('FILL_BLANK'),

    expectedAnswer: z.string().min(1),

    explanation: z.string().min(1),
  });

const shortAnswerQuestionSchema =
  baseQuestionSchema.extend({
    type: z.literal('SHORT_ANSWER'),

    modelAnswer: z.string().min(1),

    gradingInstructions:
      z.string().min(1),
  });

const longAnswerQuestionSchema =
  baseQuestionSchema.extend({
    type: z.literal('LONG_ANSWER'),

    modelAnswer: z.string().min(1),

    gradingInstructions:
      z.string().min(1),
  });

export const generatedQuestionSchema =
  z.discriminatedUnion('type', [
    mcqQuestionSchema,
    trueFalseQuestionSchema,
    fillBlankQuestionSchema,
    shortAnswerQuestionSchema,
    longAnswerQuestionSchema,
  ]);

export type GeneratedQuestion =
  z.infer<
    typeof generatedQuestionSchema
  >;

export type GeneratedQuestionDifficulty =
  z.infer<
    typeof generatedQuestionDifficultySchema
  >;

export type GeneratedQuestionType =
  z.infer<
    typeof generatedQuestionTypeSchema
  >;