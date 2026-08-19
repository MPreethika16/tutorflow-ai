import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class QuestionEmbeddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async generateAndPersistEmbedding(questionId: string): Promise<{ success: boolean }> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    const embedding = await this.embeddingService.generateEmbedding(question.prompt);

    if (embedding.length !== 1536) {
      throw new BadRequestException(`Expected embedding dimension 1536, got ${embedding.length}`);
    }

    const embeddingString = `[${embedding.join(',')}]`;

    await this.prisma.$executeRaw`
      UPDATE "Question" 
      SET embedding = ${embeddingString}::vector 
      WHERE id = ${question.id}::uuid
    `;

    return { success: true };
  }
}
