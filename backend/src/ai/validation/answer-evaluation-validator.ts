import { AnswerEvaluationResult } from '../evaluators/answer-evaluation-result';
import {
  AnswerEvaluationValidationResult,
  AnswerEvaluationValidationError,
} from './answer-evaluation-validation.types';

export function validateAnswerEvaluation(
  evaluation: AnswerEvaluationResult,
  maximumMarks: number,
): AnswerEvaluationValidationResult {
  const errors: AnswerEvaluationValidationError[] = [];

  if (evaluation.suggestedMarks < 0) {
    errors.push({
      code: 'NEGATIVE_MARKS',
      message: 'Suggested marks cannot be negative.',
    });
  }

  if (evaluation.suggestedMarks > maximumMarks) {
    errors.push({
      code: 'MARKS_EXCEED_MAXIMUM',
      message: `Suggested marks (${evaluation.suggestedMarks}) exceed maximum marks (${maximumMarks}).`,
    });
  }

  if (evaluation.confidence < 0 || evaluation.confidence > 1) {
    errors.push({
      code: 'INVALID_CONFIDENCE',
      message: `Confidence (${evaluation.confidence}) must be between 0 and 1.`,
    });
  }

  if (!evaluation.feedback || evaluation.feedback.trim().length === 0) {
    errors.push({
      code: 'EMPTY_FEEDBACK',
      message: 'Feedback must not be empty.',
    });
  }

  if (!evaluation.reasoning || evaluation.reasoning.trim().length === 0) {
    errors.push({
      code: 'EMPTY_REASONING',
      message: 'Reasoning must not be empty.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
