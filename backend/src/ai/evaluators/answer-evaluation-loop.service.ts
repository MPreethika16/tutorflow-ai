import { Injectable } from '@nestjs/common';
import { AnswerEvaluationService, AnswerEvaluationValidationException } from './answer-evaluation.service';
import type { Question, StudentAnswer } from '../../generated/prisma/client';
import type { AnswerEvaluationResult } from './answer-evaluation-result';
import { AiProviderError } from '../errors/ai-provider.error';
import { AnswerEvaluationRetryContext } from './answer-evaluation-retry-context';

export function isRetryableEvaluationError(error: unknown): boolean {
  if (error instanceof AnswerEvaluationValidationException) {
    return true;
  }

  if (error instanceof AiProviderError) {
    return (
      error.code === 'INVALID_RESPONSE' ||
      error.code === 'RATE_LIMIT' ||
      error.code === 'TIMEOUT' ||
      error.code === 'UNAVAILABLE'
    );
  }

  return false;
}

@Injectable()
export class EvaluationLoopService {
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    private readonly answerEvaluationService: AnswerEvaluationService,
  ) {}

  async evaluate(
    question: Question,
    studentAnswer: StudentAnswer,
  ): Promise<AnswerEvaluationResult> {
    let attempt = 1;
    let retryContext: AnswerEvaluationRetryContext | undefined;

    while (attempt <= this.MAX_ATTEMPTS) {
      try {
        return await this.answerEvaluationService.evaluate(
          question,
          studentAnswer,
          retryContext,
        );
      } catch (error) {
        if (!isRetryableEvaluationError(error) || attempt === this.MAX_ATTEMPTS) {
          throw error;
        }

        if (error instanceof AnswerEvaluationValidationException) {
          retryContext = {
            validationErrors: error.validationResult.errors,
          };
        } else {
          retryContext = undefined;
        }

        attempt++;
      }
    }

    // Should never reach here due to the throw in the loop, but TS needs it
    throw new Error('Unexpected EvaluationLoopService state');
  }
}
