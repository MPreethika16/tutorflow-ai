import type {
  GeneratedPaper,
} from '../contracts/generated-paper.schema';

import type {
  GeneratePaperDto,
} from '../dto/generate-paper.dto';

import type {
  PaperValidationError,
  PaperValidationResult,
} from './paper-validation.types';

function normalizePrompt(
  prompt: string,
): string {
  return prompt
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function validateGeneratedPaper(
  request: GeneratePaperDto,
  paper: GeneratedPaper,
): PaperValidationResult {
  const errors: PaperValidationError[] = [];

  // --------------------------------
  // Rule 1: paper must have questions
  // --------------------------------

  if (paper.questions.length === 0) {
    errors.push({
      code: 'NO_QUESTIONS',
      message:
        'Generated paper must contain at least one question.',
    });
  }

  // --------------------------------
  // Rule 2: marks must match request
  // --------------------------------

  const calculatedMarks =
    paper.questions.reduce(
      (sum, question) =>
        sum + question.marks,
      0,
    );

  if (
    calculatedMarks !==
    request.totalMarks
  ) {
    errors.push({
      code:
        'TOTAL_MARKS_MISMATCH',

      message:
        `Requested total is ${request.totalMarks} marks, ` +
        `but generated questions total ${calculatedMarks} marks.`,
    });
  }

  // --------------------------------
  // Rule 3: duration must match
  // --------------------------------

  if (
    paper.durationMinutes !==
    request.durationMinutes
  ) {
    errors.push({
      code:
        'DURATION_MISMATCH',

      message:
        `Requested duration is ${request.durationMinutes} minutes, ` +
        `but generated paper duration is ${paper.durationMinutes} minutes.`,
    });
  }

  // --------------------------------
  // Rule 4: duplicate prompts
  // --------------------------------

  const seenPrompts =
    new Map<string, number>();

  paper.questions.forEach(
    (question, index) => {
      const normalizedPrompt =
        normalizePrompt(
          question.prompt,
        );

      const previousIndex =
        seenPrompts.get(
          normalizedPrompt,
        );

      if (
        previousIndex !== undefined
      ) {
        errors.push({
          code:
            'DUPLICATE_QUESTION',

          message:
            `Question ${index + 1} duplicates question ${previousIndex + 1}.`,

          questionIndex: index,
        });
      } else {
        seenPrompts.set(
          normalizedPrompt,
          index,
        );
      }
    },
  );

  // --------------------------------
  // Rule 5+: type-specific checks
  // --------------------------------

  paper.questions.forEach(
    (question, index) => {
      if (
        question.type === 'MCQ'
      ) {
        const validOptionIds =
          question.options.map(
            (option) =>
              option.id,
          );

        if (
          !validOptionIds.includes(
            question.correctOption,
          )
        ) {
          errors.push({
            code:
              'MCQ_INVALID_CORRECT_OPTION',

            message:
              `Question ${index + 1} has correctOption ` +
              `"${question.correctOption}" which does not match any option id.`,

            questionIndex: index,
          });
        }
      }

      if (
        question.type ===
          'SHORT_ANSWER' ||
        question.type ===
          'LONG_ANSWER'
      ) {
        if (
          question.modelAnswer
            .trim()
            .length === 0
        ) {
          errors.push({
            code:
              'MISSING_MODEL_ANSWER',

            message:
              `Question ${index + 1} is missing a model answer.`,

            questionIndex: index,
          });
        }

        if (
          question
            .gradingInstructions
            .trim()
            .length === 0
        ) {
          errors.push({
            code:
              'MISSING_GRADING_INSTRUCTIONS',

            message:
              `Question ${index + 1} is missing grading instructions.`,

            questionIndex: index,
          });
        }
      }
    },
  );

  return {
    valid:
      errors.length === 0,

    errors,
  };
}