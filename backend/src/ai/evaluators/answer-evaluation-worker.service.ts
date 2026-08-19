import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EvaluationStatus } from '../../generated/prisma/client';

import { AnswerEvaluationPersistenceService } from './answer-evaluation-persistence.service';

const EVALUATION_POLLING_INTERVAL_MS = 10000; // 10 seconds
const EVALUATION_BATCH_SIZE = 5;

@Injectable()
export class AnswerEvaluationWorkerService {
  private readonly logger = new Logger(AnswerEvaluationWorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluationPersistenceService: AnswerEvaluationPersistenceService,
  ) {}

  @Interval(EVALUATION_POLLING_INTERVAL_MS)
  async pollPendingEvaluations() {
    try {
      const claimed = await this.claimPendingEvaluations(EVALUATION_BATCH_SIZE);

      if (claimed.length > 0) {
        this.logger.log(`Claimed ${claimed.length} PENDING answer evaluation(s). IDs: ${claimed.map(c => c.id).join(', ')}`);
        await this.processClaimedBatch(claimed);
      }
    } catch (error) {
      this.logger.error('Error polling pending evaluations', error);
    }
  }

  async claimPendingEvaluations(batchSize: number) {
    // We use a raw query because Prisma does not natively support SKIP LOCKED.
    // This CTE safely selects a batch of PENDING rows, locks them, and updates them to EVALUATING.
    return this.prisma.$queryRaw<{ id: string; studentAnswerId: string }[]>`
      WITH claimed AS (
        SELECT id FROM "AnswerEvaluation"
        WHERE status = 'PENDING'
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "AnswerEvaluation"
      SET status = 'EVALUATING', "updatedAt" = NOW()
      WHERE id IN (SELECT id FROM claimed)
      RETURNING id, "studentAnswerId";
    `;
  }

  private async processClaimedBatch(claimed: { id: string; studentAnswerId: string }[]) {
    for (const claim of claimed) {
      try {
        const studentAnswer = await this.prisma.studentAnswer.findUnique({
          where: { id: claim.studentAnswerId },
          include: { question: true },
        });

        if (!studentAnswer || !studentAnswer.question) {
          throw new Error('StudentAnswer or Question not found for claimed evaluation');
        }

        await this.evaluationPersistenceService.evaluateAndPersist(studentAnswer.question, studentAnswer);
      } catch (error) {
        this.logger.error(`Failed to evaluate claimed answer evaluation ${claim.id}`, error);
        await this.markEvaluationAsFailed(claim.id);
      }
    }
  }

  private async markEvaluationAsFailed(evaluationId: string) {
    try {
      await this.prisma.answerEvaluation.update({
        where: { id: evaluationId },
        data: { status: EvaluationStatus.FAILED },
      });
    } catch (error) {
      this.logger.error(`Failed to mark evaluation ${evaluationId} as FAILED`, error);
    }
  }
}
