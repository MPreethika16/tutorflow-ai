import { Module } from '@nestjs/common';

import { AiService } from './ai.service';
import { PaperGenerationService } from './paper-generation.service';
import { AI_PROVIDER } from './providers/ai-provider.token';
import { OpenRouterProvider } from './providers/openrouter.provider';

@Module({
  providers: [
    AiService,
    PaperGenerationService,
    OpenRouterProvider,
    {
      provide: AI_PROVIDER,
      useExisting: OpenRouterProvider,
    },
  ],
  exports: [
    AiService,
    PaperGenerationService,
  ],
})
export class AiModule {}