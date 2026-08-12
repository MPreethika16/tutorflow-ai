import { Module } from '@nestjs/common';

import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AI_PROVIDER } from './providers/ai-provider.token';
import { OpenRouterProvider } from './providers/openrouter.provider';


@Module({
  controllers: [AiController],
  providers: [
    AiService,
    OpenRouterProvider,
    {
      provide: AI_PROVIDER,
      useExisting: OpenRouterProvider,
    },
  ],
  exports: [AiService],
})
export class AiModule {}