import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Question, StudentAnswer, QuestionType } from '../../generated/prisma/client';
import { AiService } from '../ai.service';
import { answerEvaluationResultSchema, AnswerEvaluationResult } from './answer-evaluation-result';
import { buildTypedEvaluationMessages } from '../prompts/typed-evaluation.prompt';

@Injectable()
export class TypedEvaluatorService {
  constructor(private readonly aiService: AiService) {}

  async evaluate(question: Question, studentAnswer: StudentAnswer): Promise<AnswerEvaluationResult> {
    if (question.type !== QuestionType.TYPED) {
      throw new BadRequestException('Question must be of type TYPED');
    }

    if (!studentAnswer.textAnswer || studentAnswer.textAnswer.trim().length === 0) {
      return {
        suggestedMarks: 0,
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
    });

    const result = await this.aiService.generateStructured<AnswerEvaluationResult>(
      { messages },
      answerEvaluationResultSchema,
      'answer_evaluation_result',
    );

    if (result.suggestedMarks > question.marks) {
      throw new InternalServerErrorException(
        `Suggested marks (${result.suggestedMarks}) exceed maximum marks (${question.marks})`,
      );
    }

    return result;
  }
}
