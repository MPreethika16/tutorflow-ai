import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service';
import { EMBEDDING_PROVIDER } from './providers/embedding-provider.token';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  
  const mockProvider = {
    generateEmbedding: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: EMBEDDING_PROVIDER,
          useValue: mockProvider,
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should delegate text to the provider and return the embedding', async () => {
    const mockEmbedding = [0.1, 0.2, 0.3];
    mockProvider.generateEmbedding.mockResolvedValue(mockEmbedding);

    const result = await service.generateEmbedding('test text');

    expect(mockProvider.generateEmbedding).toHaveBeenCalledWith('test text');
    expect(result).toEqual(mockEmbedding);
  });

  it('should propagate provider errors', async () => {
    const error = new Error('Provider error');
    mockProvider.generateEmbedding.mockRejectedValue(error);

    await expect(service.generateEmbedding('test text')).rejects.toThrow(error);
  });
});
