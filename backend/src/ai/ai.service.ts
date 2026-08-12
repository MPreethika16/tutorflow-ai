import {
  Inject,
  Injectable,
  InternalServerErrorException,
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

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER)
    private readonly provider: AiProvider,
  ) {}

  generateText(
    request: AiGenerateTextRequest,
  ): Promise<AiGenerateTextResponse> {
    return this.provider.generateText(
      request,
    );
  }

  async generateStructured<T>(
    request: AiGenerateTextRequest,
    schema: ZodType<T>,
    schemaName: string,
  ): Promise<T> {
    const jsonSchema =
      toJSONSchema(schema);

    const response =
      await this.provider.generateText({
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
      parsed =
        JSON.parse(response.content);
    } catch {
      throw new InternalServerErrorException(
        'AI provider returned invalid JSON',
      );
    }

    const result =
      schema.safeParse(parsed);

    if (!result.success) {
      throw new InternalServerErrorException(
        'AI provider returned invalid structured output',
      );
    }

    return result.data;
  }

  // Temporary integration test method.
  // Remove this after #40 validation is complete.
 
}