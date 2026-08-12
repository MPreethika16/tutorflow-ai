import { Injectable } from '@nestjs/common';

import { AiProviderError } from '../errors/ai-provider.error';
import type {
  AiGenerateTextRequest,
  AiGenerateTextResponse,
  AiProvider,
} from './ai-provider.interface';

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

@Injectable()
export class OpenRouterProvider
  implements AiProvider
{
  async generateText(
    request: AiGenerateTextRequest,
  ): Promise<AiGenerateTextResponse> {
    const apiKey =
      process.env.OPENROUTER_API_KEY;

    const model =
      process.env.OPENROUTER_MODEL;

    const baseUrl =
      process.env.OPENROUTER_BASE_URL ??
      'https://openrouter.ai/api/v1';

    if (!apiKey || !model) {
      throw new AiProviderError(
        'CONFIGURATION',
        'AI provider configuration is missing',
      );
    }

    const body: Record<string, unknown> = {
      model,
      messages: request.messages,
    };

    if (request.structuredOutput) {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name:
            request.structuredOutput.name,
          strict: true,
          schema:
            request.structuredOutput.schema,
        },
      };
    }

    let response: Response;
    const controller =
  new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        15_000,
      );

    try {
  response = await fetch(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${apiKey}`,
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify(body),

      signal: controller.signal,
    },
  );
} catch (error: unknown) {
  if (
    error instanceof Error &&
    error.name === 'AbortError'
  ) {
    throw new AiProviderError(
      'TIMEOUT',
      'AI provider request timed out',
    );
  }

  throw new AiProviderError(
    'UNAVAILABLE',
    'AI provider request failed',
  );
} finally {
  clearTimeout(timeout);
}

    if (!response.ok) {
      throw this.mapHttpError(
        response.status,
      );
    }

    let data: OpenRouterResponse;

    try {
      data =
        (await response.json()) as OpenRouterResponse;
    } catch {
      throw new AiProviderError(
        'INVALID_RESPONSE',
        'AI provider returned invalid JSON',
      );
    }

    const content =
      data.choices?.[0]
        ?.message?.content;

    if (
      typeof content !== 'string' ||
      content.trim().length === 0
    ) {
      throw new AiProviderError(
        'INVALID_RESPONSE',
        'AI provider response did not contain content',
      );
    }

    return {
      content,
    };
  }

  private mapHttpError(
    statusCode: number,
  ): AiProviderError {
    if (
      statusCode === 401 ||
      statusCode === 403
    ) {
      return new AiProviderError(
        'AUTHENTICATION',
        'AI provider authentication failed',
        statusCode,
      );
    }

    if (statusCode === 429) {
      return new AiProviderError(
        'RATE_LIMIT',
        'AI provider rate limit exceeded',
        statusCode,
      );
    }

    if (
      statusCode === 502 ||
      statusCode === 503 ||
      statusCode === 504
    ) {
      return new AiProviderError(
        'UNAVAILABLE',
        'AI provider is unavailable',
        statusCode,
      );
    }

    return new AiProviderError(
      'UNKNOWN',
      'AI provider request failed',
      statusCode,
    );
  }
  
}