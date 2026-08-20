import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Question, StudentAnswer, QuestionType } from '../../generated/prisma/client';
import { AiService } from '../ai.service';
import { answerEvaluationResultSchema, AnswerEvaluationResult } from './answer-evaluation-result';
import { buildTypedEvaluationMessages } from '../prompts/typed-evaluation.prompt';
import { AnswerEvaluationRetryContext } from './answer-evaluation-retry-context';

@Injectable()
export class TypedEvaluatorService {
  constructor(private readonly aiService: AiService) {}

  async evaluate(
    question: Question,
    studentAnswer: StudentAnswer,
    retryContext?: AnswerEvaluationRetryContext,
  ): Promise<AnswerEvaluationResult> {
    if (question.type !== QuestionType.TYPED) {
      throw new BadRequestException('Question must be of type TYPED');
    }

    if (!studentAnswer.textAnswer || studentAnswer.textAnswer.trim().length === 0) {
      return {
        suggestedMarks: 0,
        criteria: [{ criterion: 'Answered question', awardedMarks: 0, maxMarks: question.marks, status: 'NOT_MET' }],
        feedback: 'No answer was provided.',
        reasoning: 'The student did not submit a written answer.',
        confidence: 1,
      };
    }

    const messages = buildTypedEvaluationMessages({
      prompt: question.prompt,
      modelAnswer: question.modelAnswer,
      gradingInstructions: question.gradingInstructions,
      marks: question.marks,
      studentAnswer: studentAnswer.textAnswer,
      previousErrors: retryContext?.validationErrors,
    });

    const result = await this.aiService.generateStructured<AnswerEvaluationResult>(
      { messages },
      answerEvaluationResultSchema,
      'answer_evaluation_result',
    );

    return result;
  }
}
