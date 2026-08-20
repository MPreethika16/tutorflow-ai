export type AnswerEvaluationErrorCode =
  | 'NEGATIVE_MARKS'
  | 'MARKS_EXCEED_MAXIMUM'
  | 'INVALID_CONFIDENCE'
  | 'EMPTY_FEEDBACK'
  | 'EMPTY_REASONING'
  | 'DUPLICATE_CRITERION'
  | 'MARKS_MISMATCH'
  | 'MAX_MARKS_MISMATCH';

export interface AnswerEvaluationValidationError {
  code: AnswerEvaluationErrorCode;
  message: string;
}

export interface AnswerEvaluationValidationResult {
  valid: boolean;
  errors: AnswerEvaluationValidationError[];
}
