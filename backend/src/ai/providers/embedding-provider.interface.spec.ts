import { EmbeddingProvider } from './embedding-provider.interface';

class MockEmbeddingProvider implements EmbeddingProvider {
  async generateEmbedding(text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }
}

describe('EmbeddingProvider Contract', () => {
  it('should define a generateEmbedding method returning a numeric array', async () => {
    const provider: EmbeddingProvider = new MockEmbeddingProvider();
    const result = await provider.generateEmbedding('test embedding');
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);
    expect(result[0]).toBe(0.1);
  });
});
