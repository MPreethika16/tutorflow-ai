import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

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

    if (!apiKey) {
      throw new InternalServerErrorException(
        'AI provider is not configured',
      );
    }

    if (!model) {
      throw new InternalServerErrorException(
        'AI model is not configured',
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
        },
      );
    } catch {
      throw new InternalServerErrorException(
        'AI provider request failed',
      );
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        'AI provider request failed',
      );
    }

    let data: OpenRouterResponse;

    try {
      data =
        (await response.json()) as OpenRouterResponse;
    } catch {
      throw new InternalServerErrorException(
        'AI provider returned an invalid response',
      );
    }

    const content =
      data.choices?.[0]
        ?.message?.content;

    if (
      typeof content !== 'string' ||
      content.trim().length === 0
    ) {
      throw new InternalServerErrorException(
        'AI provider returned an invalid response',
      );
    }

    return {
      content,
    };
  }
}