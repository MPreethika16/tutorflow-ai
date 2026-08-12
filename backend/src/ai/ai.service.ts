import { Inject, Injectable } from '@nestjs/common';

import type {
  AiGenerateTextRequest,
  AiGenerateTextResponse,
  AiProvider,
} from './providers/ai-provider.interface';
import { AI_PROVIDER } from './providers/ai-provider.token';

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER)
    private readonly provider: AiProvider,
  ) {}

  generateText(
    request: AiGenerateTextRequest,
  ): Promise<AiGenerateTextResponse> {
    return this.provider.generateText(request);
  }

  testConnection() {
    return this.generateText({
      messages: [
        {
          role: 'system',
          content:
            'You are a concise AI assistant.',
        },
        {
          role: 'user',
          content:
            'Reply with exactly: TutorFlow AI connected',
        },
      ],
    });
  }
}