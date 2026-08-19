import { Injectable, NotImplementedException, InternalServerErrorException } from '@nestjs/common';
import { Question, StudentAnswer, QuestionType } from '../../generated/prisma/client';
import { McqEvaluatorService } from './mcq-evaluator.service';
import { TypedEvaluatorService } from './typed-evaluator.service';
import { AnswerEvaluationResult } from './answer-evaluation-result';
import { validateAnswerEvaluation } from '../validation/answer-evaluation-validator';
import { AnswerEvaluationValidationResult } from '../validation/answer-evaluation-validation.types';
import { AnswerEvaluationRetryContext } from './answer-evaluation-retry-context';

export class AnswerEvaluationValidationException extends InternalServerErrorException {
  constructor(public readonly validationResult: AnswerEvaluationValidationResult) {
    super('Answer evaluation failed validation constraints.');
  }
}

@Injectable()
export class AnswerEvaluationService {
  constructor(
    private readonly mcqEvaluator: McqEvaluatorService,
    private readonly typedEvaluator: TypedEvaluatorService,
  ) {}

  async evaluate(
    question: Question,
    studentAnswer: StudentAnswer,
    retryContext?: AnswerEvaluationRetryContext,
  ): Promise<AnswerEvaluationResult> {
    let result: AnswerEvaluationResult;

    switch (question.type) {
      case QuestionType.MCQ:
        result = await this.mcqEvaluator.evaluate(question, studentAnswer);
        break;
      case QuestionType.TYPED:
        result = await this.typedEvaluator.evaluate(question, studentAnswer, retryContext);
        break;
      case QuestionType.VOICE:
        throw new NotImplementedException('Voice answer evaluation is not implemented yet.');
      default:
        throw new NotImplementedException(`Unsupported question type: ${question.type}`);
    }

    const validation = validateAnswerEvaluation(result, question.marks);

    if (!validation.valid) {
      throw new AnswerEvaluationValidationException(validation);
    }

    return result;
  }
}
