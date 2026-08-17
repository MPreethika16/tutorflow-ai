export type PaperValidationErrorCode =
  | 'TOTAL_MARKS_MISMATCH'
  | 'NO_QUESTIONS'
  | 'DUPLICATE_QUESTION'
  | 'MCQ_INVALID_CORRECT_OPTION'
  | 'MISSING_MODEL_ANSWER'
  | 'MISSING_GRADING_INSTRUCTIONS'
  | 'DURATION_MISMATCH';

export type PaperValidationError = {
  code: PaperValidationErrorCode;
  message: string;
  questionIndex?: number;
};

export type PaperValidationResult = {
  valid: boolean;
  errors: PaperValidationError[];
};