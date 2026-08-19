import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EvaluationLoopService } from './answer-evaluation-loop.service';
import { Question, StudentAnswer, EvaluationStatus, AnswerEvaluation } from '../../generated/prisma/client';

@Injectable()
export class AnswerEvaluationPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluationLoopService: EvaluationLoopService,
  ) {}

  async evaluateAndPersist(question: Question, studentAnswer: StudentAnswer): Promise<AnswerEvaluation> {
    const evaluationResult = await this.evaluationLoopService.evaluate(question, studentAnswer);

    return this.prisma.answerEvaluation.upsert({
      where: {
        studentAnswerId: studentAnswer.id,
      },
      create: {
        studentAnswerId: studentAnswer.id,
        aiMarks: evaluationResult.suggestedMarks,
        aiFeedback: evaluationResult.feedback,
        aiReasoning: evaluationResult.reasoning,
        aiConfidence: evaluationResult.confidence,
        status: EvaluationStatus.WAITING_FOR_REVIEW,
      },
      update: {
        aiMarks: evaluationResult.suggestedMarks,
        aiFeedback: evaluationResult.feedback,
        aiReasoning: evaluationResult.reasoning,
        aiConfidence: evaluationResult.confidence,
        status: EvaluationStatus.WAITING_FOR_REVIEW,
      },
    });
  }
}
