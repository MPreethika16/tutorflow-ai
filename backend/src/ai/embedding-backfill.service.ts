import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionEmbeddingService } from './question-embedding.service';

@Injectable()
export class EmbeddingBackfillService {
  private readonly logger = new Logger(EmbeddingBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly questionEmbeddingService: QuestionEmbeddingService,
  ) {}

  async backfillEmbeddings(): Promise<{ processed: number; failed: number }> {
    const questionsWithoutEmbeddings = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Question" WHERE embedding IS NULL
    `;

    let processed = 0;
    let failed = 0;

    for (const { id } of questionsWithoutEmbeddings) {
      try {
        await this.questionEmbeddingService.generateAndPersistEmbedding(id);
        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to backfill embedding for Question ${id}`,
          error instanceof Error ? error.stack : String(error),
        );
        failed++;
      }
    }

    return { processed, failed };
  }
}
