import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingBackfillService } from './embedding-backfill.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionEmbeddingService } from './question-embedding.service';
import { Logger } from '@nestjs/common';

describe('EmbeddingBackfillService', () => {
  let service: EmbeddingBackfillService;
  
  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockQuestionEmbeddingService = {
    generateAndPersistEmbedding: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingBackfillService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: QuestionEmbeddingService,
          useValue: mockQuestionEmbeddingService,
        },
      ],
    }).compile();

    service = module.get<EmbeddingBackfillService>(EmbeddingBackfillService);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process multiple questions sequentially', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([{ id: 'q1' }, { id: 'q2' }]);
    mockQuestionEmbeddingService.generateAndPersistEmbedding.mockResolvedValue({ success: true });

    const result = await service.backfillEmbeddings();

    expect(result).toEqual({ processed: 2, failed: 0 });
    expect(mockQuestionEmbeddingService.generateAndPersistEmbedding).toHaveBeenCalledTimes(2);
    expect(mockQuestionEmbeddingService.generateAndPersistEmbedding).toHaveBeenNthCalledWith(1, 'q1');
    expect(mockQuestionEmbeddingService.generateAndPersistEmbedding).toHaveBeenNthCalledWith(2, 'q2');
  });

  it('should skip already embedded questions by not finding them in the query', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([]);

    const result = await service.backfillEmbeddings();

    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(mockQuestionEmbeddingService.generateAndPersistEmbedding).not.toHaveBeenCalled();
  });

  it('should continue if one question fails and log the error', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]);
    
    mockQuestionEmbeddingService.generateAndPersistEmbedding
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('Generation failed'))
      .mockResolvedValueOnce({ success: true });

    const result = await service.backfillEmbeddings();

    expect(result).toEqual({ processed: 2, failed: 1 });
    expect(mockQuestionEmbeddingService.generateAndPersistEmbedding).toHaveBeenCalledTimes(3);
  });
});
