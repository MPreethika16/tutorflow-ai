import { Test, TestingModule } from '@nestjs/testing';
import { QuestionEmbeddingService } from './question-embedding.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('QuestionEmbeddingService', () => {
  let service: QuestionEmbeddingService;
  
  const mockPrismaService = {
    question: {
      findUnique: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };

  const mockEmbeddingService = {
    generateEmbedding: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionEmbeddingService,
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

    service = module.get<QuestionEmbeddingService>(QuestionEmbeddingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully generate and persist an embedding', async () => {
    const mockQuestion = { id: 'test-uuid', prompt: 'test prompt' };
    const mockEmbedding = new Array(1536).fill(0.1);
    
    mockPrismaService.question.findUnique.mockResolvedValue(mockQuestion);
    mockEmbeddingService.generateEmbedding.mockResolvedValue(mockEmbedding);
    mockPrismaService.$executeRaw.mockResolvedValue(1);

    const result = await service.generateAndPersistEmbedding('test-uuid');

    expect(result).toEqual({ success: true });
    expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test prompt');
    expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
  });

  it('should throw NotFoundException if question is not found', async () => {
    mockPrismaService.question.findUnique.mockResolvedValue(null);

    await expect(service.generateAndPersistEmbedding('missing-uuid'))
      .rejects.toThrow(NotFoundException);
    
    expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
  });

  it('should propagate embedding provider failure', async () => {
    const mockQuestion = { id: 'test-uuid', prompt: 'test prompt' };
    mockPrismaService.question.findUnique.mockResolvedValue(mockQuestion);
    
    const error = new Error('Provider error');
    mockEmbeddingService.generateEmbedding.mockRejectedValue(error);

    await expect(service.generateAndPersistEmbedding('test-uuid'))
      .rejects.toThrow(error);
  });

  it('should throw BadRequestException for invalid dimension', async () => {
    const mockQuestion = { id: 'test-uuid', prompt: 'test prompt' };
    const invalidEmbedding = new Array(100).fill(0.1);
    
    mockPrismaService.question.findUnique.mockResolvedValue(mockQuestion);
    mockEmbeddingService.generateEmbedding.mockResolvedValue(invalidEmbedding);

    await expect(service.generateAndPersistEmbedding('test-uuid'))
      .rejects.toThrow(BadRequestException);
      
    expect(mockPrismaService.$executeRaw).not.toHaveBeenCalled();
  });
});
