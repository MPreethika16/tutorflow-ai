import { Inject, Injectable } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from './providers/embedding-provider.token';
import type { EmbeddingProvider } from './providers/embedding-provider.interface';

@Injectable()
export class EmbeddingService {
  constructor(
    @Inject(EMBEDDING_PROVIDER)
    private readonly provider: EmbeddingProvider,
  ) {}

  async generateEmbedding(text: string): Promise<number[]> {
    return this.provider.generateEmbedding(text);
  }
}
