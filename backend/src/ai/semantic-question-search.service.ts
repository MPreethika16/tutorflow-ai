import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { QuestionType } from '../generated/prisma/client';

export interface SemanticSearchResult {
  id: string;
  prompt: string;
  marks: number;
  type: QuestionType;
  distance: number;
}

@Injectable()
export class SemanticQuestionSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async searchSimilarQuestions(query: string, limit = 5): Promise<SemanticSearchResult[]> {
    const embedding = await this.embeddingService.generateEmbedding(query);
    const embeddingString = `[${embedding.join(',')}]`;

    // Calculate cosine distance using the <=> operator
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT 
        id, 
        prompt, 
        marks, 
        type, 
        embedding <=> ${embeddingString}::vector AS distance
      FROM "Question"
      WHERE embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT ${limit}
    `;

    return results.map(row => ({
      id: row.id,
      prompt: row.prompt,
      marks: row.marks,
      type: row.type as QuestionType,
      distance: typeof row.distance === 'number' ? row.distance : parseFloat(row.distance),
    }));
  }
}
