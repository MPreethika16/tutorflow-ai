import {
  Prisma,
  QuestionType,
} from '../../generated/prisma/client';

import type {
  GeneratedQuestion,
} from './../contracts/generated-question.schema';

type PersistedQuestionData = {
  type: QuestionType;
  prompt: string;
  marks: number;

  options:
    | Prisma.InputJsonValue
    | null;

  correctOption: string | null;
  explanation: string | null;
  modelAnswer: string | null;
  gradingInstructions: string | null;
};

export function mapGeneratedQuestion(
  question: GeneratedQuestion,
): PersistedQuestionData {
  switch (question.type) {
    case 'MCQ':
      return {
        type: QuestionType.MCQ,
        prompt: question.prompt,
        marks: question.marks,

        options:
          question.options as Prisma.InputJsonValue,

        correctOption:
          question.correctOption,

        explanation:
          question.explanation,

        modelAnswer: null,
        gradingInstructions: null,
      };

    case 'TRUE_FALSE':
      return {
        type: QuestionType.MCQ,
        prompt: question.prompt,
        marks: question.marks,

        options: [
          {
            id: 'A',
            text: 'True',
          },
          {
            id: 'B',
            text: 'False',
          },
        ],

        correctOption:
          question.correctAnswer
            ? 'A'
            : 'B',

        explanation:
          question.explanation,

        modelAnswer: null,
        gradingInstructions: null,
      };

    case 'FILL_BLANK':
      return {
        type: QuestionType.TYPED,
        prompt: question.prompt,
        marks: question.marks,

        options: null,
        correctOption: null,

        explanation:
          question.explanation,

        modelAnswer:
          question.expectedAnswer,

        gradingInstructions:
          'Award marks for a correct answer matching the expected answer.',
      };

    case 'SHORT_ANSWER':
    case 'LONG_ANSWER':
      return {
        type: QuestionType.TYPED,
        prompt: question.prompt,
        marks: question.marks,

        options: null,
        correctOption: null,
        explanation: null,

        modelAnswer:
          question.modelAnswer,

        gradingInstructions:
          question.gradingInstructions,
      };
  }
}