import { AnswerEvaluationValidationError } from '../validation/answer-evaluation-validation.types';

export type AnswerEvaluationRetryContext = {
  validationErrors: AnswerEvaluationValidationError[];
};
