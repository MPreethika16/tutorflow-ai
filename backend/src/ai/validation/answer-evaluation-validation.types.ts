export type AnswerEvaluationErrorCode =
  | 'NEGATIVE_MARKS'
  | 'MARKS_EXCEED_MAXIMUM'
  | 'INVALID_CONFIDENCE'
  | 'EMPTY_FEEDBACK'
  | 'EMPTY_REASONING';

export interface AnswerEvaluationValidationError {
  code: AnswerEvaluationErrorCode;
  message: string;
}

export interface AnswerEvaluationValidationResult {
  valid: boolean;
  errors: AnswerEvaluationValidationError[];
}
