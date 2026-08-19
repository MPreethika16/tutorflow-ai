import { Injectable } from '@nestjs/common';
import { AiProviderError } from '../errors/ai-provider.error';
import { EmbeddingProvider } from './embedding-provider.interface';

type OpenRouterEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

@Injectable()
export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = 'openai/text-embedding-3-small';
    const baseUrl = 'https://openrouter.ai/api/v1';

    if (!apiKey) {
      throw new AiProviderError('CONFIGURATION', 'OpenRouter API key is missing');
    }

    const body = {
      model,
      input: text,
    };

    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      response = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'TutorFlow',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProviderError('TIMEOUT', 'Embedding request timed out');
      }
      throw new AiProviderError('UNAVAILABLE', 'Embedding request failed');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw this.mapHttpError(response.status);
    }

    let data: OpenRouterEmbeddingResponse;

    try {
      data = (await response.json()) as OpenRouterEmbeddingResponse;
    } catch {
      throw new AiProviderError('INVALID_RESPONSE', 'OpenRouter returned invalid JSON');
    }

    const embedding = data.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new AiProviderError('INVALID_RESPONSE', 'OpenRouter response did not contain embedding');
    }

    return embedding;
  }

  private mapHttpError(statusCode: number): AiProviderError {
    if (statusCode === 401 || statusCode === 403) {
      return new AiProviderError('AUTHENTICATION', 'OpenRouter authentication failed', statusCode);
    }
    if (statusCode === 429) {
      return new AiProviderError('RATE_LIMIT', 'OpenRouter rate limit exceeded', statusCode);
    }
    if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
      return new AiProviderError('UNAVAILABLE', 'OpenRouter is unavailable', statusCode);
    }
    return new AiProviderError('UNKNOWN', 'OpenRouter request failed', statusCode);
  }
}
