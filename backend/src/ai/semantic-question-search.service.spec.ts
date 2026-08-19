import { Test, TestingModule } from '@nestjs/testing';
import { SemanticQuestionSearchService } from './semantic-question-search.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { QuestionType } from '../generated/prisma/client';

describe('SemanticQuestionSearchService', () => {
  let service: SemanticQuestionSearchService;
  
  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockEmbeddingService = {
    generateEmbedding: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SemanticQuestionSearchService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmbeddingService,
          useValue: mockEmbeddingService,
        },
      ],
    }).compile();

    service = module.get<SemanticQuestionSearchService>(SemanticQuestionSearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return ranked similar questions', async () => {
    mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
    mockPrismaService.$queryRaw.mockResolvedValue([
      { id: '1', prompt: 'Q1', marks: 5, type: QuestionType.MCQ, distance: 0.05 },
      { id: '2', prompt: 'Q2', marks: 10, type: QuestionType.TYPED, distance: '0.15' }, // Test float parsing
    ]);

    const results = await service.searchSimilarQuestions('test query');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: '1', prompt: 'Q1', marks: 5, type: QuestionType.MCQ, distance: 0.05 });
    expect(results[1]).toEqual({ id: '2', prompt: 'Q2', marks: 10, type: QuestionType.TYPED, distance: 0.15 });
    expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test query');
    expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
  });

  it('should handle no results gracefully (ignores questions without embeddings naturally due to WHERE clause in mock)', async () => {
    mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
    mockPrismaService.$queryRaw.mockResolvedValue([]);

    const results = await service.searchSimilarQuestions('test query');

    expect(results).toEqual([]);
  });

  it('should propagate embedding generation failure', async () => {
    const error = new Error('Embedding failed');
    mockEmbeddingService.generateEmbedding.mockRejectedValue(error);

    await expect(service.searchSimilarQuestions('test query')).rejects.toThrow(error);
    expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
  });
});
