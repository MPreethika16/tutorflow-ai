import { Test, TestingModule } from '@nestjs/testing';
import { AiModule } from './ai.module';
import { EMBEDDING_PROVIDER } from './providers/embedding-provider.token';
import { OpenRouterEmbeddingProvider } from './providers/openrouter-embedding.provider';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

describe('AiModule DI', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AiModule,
      ],
    }).compile();
  });

  it('should resolve EMBEDDING_PROVIDER to OpenRouterEmbeddingProvider', () => {
    const provider = module.get(EMBEDDING_PROVIDER);
    expect(provider).toBeInstanceOf(OpenRouterEmbeddingProvider);
  });
});
