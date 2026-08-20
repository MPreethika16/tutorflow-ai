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

  if (evaluation.criteria && evaluation.criteria.length > 0) {
    let sumAwarded = 0;
    let sumMax = 0;
    const seenCriteria = new Set<string>();

    for (const c of evaluation.criteria) {
      if (c.awardedMarks < 0) {
        errors.push({ code: 'NEGATIVE_MARKS', message: `Criterion '${c.criterion}' awarded marks cannot be negative.` });
      }
      if (c.awardedMarks > c.maxMarks) {
        errors.push({ code: 'MARKS_EXCEED_MAXIMUM', message: `Criterion '${c.criterion}' awarded marks (${c.awardedMarks}) exceed its max marks (${c.maxMarks}).` });
      }
      if (seenCriteria.has(c.criterion)) {
        errors.push({ code: 'DUPLICATE_CRITERION', message: `Duplicate criterion found: '${c.criterion}'.` });
      }
      seenCriteria.add(c.criterion);
      sumAwarded += c.awardedMarks;
      sumMax += c.maxMarks;
    }

    if (sumAwarded !== evaluation.suggestedMarks) {
      errors.push({ code: 'MARKS_MISMATCH', message: `Sum of criteria awarded marks (${sumAwarded}) does not equal suggestedMarks (${evaluation.suggestedMarks}).` });
    }
    
    if (sumMax !== maximumMarks) {
      errors.push({ code: 'MAX_MARKS_MISMATCH', message: `Sum of criteria max marks (${sumMax}) does not equal question maximum marks (${maximumMarks}).` });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
