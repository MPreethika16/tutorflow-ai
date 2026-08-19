import { OpenRouterEmbeddingProvider } from './openrouter-embedding.provider';
import { AiProviderError } from '../errors/ai-provider.error';

describe('OpenRouterEmbeddingProvider', () => {
  let provider: OpenRouterEmbeddingProvider;
  let originalEnv: NodeJS.ProcessEnv;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    provider = new OpenRouterEmbeddingProvider();
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    process.env = originalEnv;
    fetchMock.mockRestore();
  });

  it('should generate an embedding successfully', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: new Array(1536).fill(0.1) }],
      }),
    } as Response);

    const result = await provider.generateEmbedding('hello world');
    
    expect(result).toHaveLength(1536);
    expect(result[0]).toBe(0.1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: 'hello world',
        }),
      })
    );
  });

  it('should throw CONFIGURATION error if API key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;

    await expect(provider.generateEmbedding('test')).rejects.toThrow(
      new AiProviderError('CONFIGURATION', 'OpenRouter API key is missing')
    );
  });

  it('should throw UNAVAILABLE error if fetch throws an error (network error)', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    await expect(provider.generateEmbedding('test')).rejects.toThrow(
      new AiProviderError('UNAVAILABLE', 'Embedding request failed')
    );
  });

  it('should throw AUTHENTICATION error on 401 HTTP error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    await expect(provider.generateEmbedding('test')).rejects.toThrow(
      new AiProviderError('AUTHENTICATION', 'OpenRouter authentication failed', 401)
    );
  });

  it('should throw INVALID_RESPONSE error on malformed response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: null }], // malformed
      }),
    } as Response);

    await expect(provider.generateEmbedding('test')).rejects.toThrow(
      new AiProviderError('INVALID_RESPONSE', 'OpenRouter response did not contain embedding')
    );
  });
});
