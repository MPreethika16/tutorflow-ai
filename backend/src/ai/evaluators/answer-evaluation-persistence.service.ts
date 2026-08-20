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

    let formattedReasoning = evaluationResult.reasoning;
    if (evaluationResult.criteria && evaluationResult.criteria.length > 0) {
      formattedReasoning = `### Rubric Breakdown\n\n| Criterion | Status | Marks |\n|---|---|---|\n`;
      for (const c of evaluationResult.criteria) {
        formattedReasoning += `| ${c.criterion} | ${c.status} | ${c.awardedMarks}/${c.maxMarks} |\n`;
      }
      formattedReasoning += `\n**Total: ${evaluationResult.suggestedMarks} marks**\n\n### Reasoning\n\n${evaluationResult.reasoning}`;
    }

    return this.prisma.answerEvaluation.upsert({
      where: {
        studentAnswerId: studentAnswer.id,
      },
      create: {
        studentAnswerId: studentAnswer.id,
        aiMarks: evaluationResult.suggestedMarks,
        aiFeedback: evaluationResult.feedback,
        aiReasoning: formattedReasoning,
        aiConfidence: evaluationResult.confidence,
        status: EvaluationStatus.WAITING_FOR_REVIEW,
      },
      update: {
        aiMarks: evaluationResult.suggestedMarks,
        aiFeedback: evaluationResult.feedback,
        aiReasoning: formattedReasoning,
        aiConfidence: evaluationResult.confidence,
        status: EvaluationStatus.WAITING_FOR_REVIEW,
      },
    });
  }
}
