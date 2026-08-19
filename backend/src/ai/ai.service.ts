import {
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  toJSONSchema,
  type ZodType,
} from 'zod';

import type {
  AiGenerateTextRequest,
  AiGenerateTextResponse,
  AiProvider,
} from './providers/ai-provider.interface';
import { AI_PROVIDER } from './providers/ai-provider.token';
import {
  aiTopicAnalysisSchema,
  type AiTopicAnalysis,
} from './schemas/ai-topic-analysis.schema';

import { AiProviderError } from './errors/ai-provider.error';
@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER)
    private readonly provider: AiProvider,
  ) {}

  async generateText(
    request: AiGenerateTextRequest,
  ): Promise<AiGenerateTextResponse> {
    try {
      return await this.provider.generateText(
        request,
      );
    } catch (error: unknown) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw new AiProviderError('UNKNOWN', 'AI service encountered an unknown error', undefined, error);
    }
  }

  async generateStructured<T>(
    request: AiGenerateTextRequest,
    schema: ZodType<T>,
    schemaName: string,
  ): Promise<T> {
    const jsonSchema =
      toJSONSchema(schema);

    const response =
  await this.generateText({
    ...request,

    structuredOutput: {
      name: schemaName,

      schema:
        jsonSchema as Record<
          string,
          unknown
        >,
    },
  });

    let parsed: unknown;

    try {
      parsed = JSON.parse(response.content);
    } catch (error) {
      throw new AiProviderError(
        'INVALID_RESPONSE',
        'AI provider returned invalid JSON',
        undefined,
        error
      );
    }

    const result =
      schema.safeParse(parsed);

    if (!result.success) {
      throw new AiProviderError(
        'INVALID_RESPONSE',
        'AI provider returned invalid structured output',
        undefined,
        result.error
      );
    }

    return result.data;
  }

  


 
}