import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeneratedPaperPersistenceService } from './generated-paper-persistence.service';
import { PaperGenerationService } from './paper-generation.service';
import { AI_PROVIDER } from './providers/ai-provider.token';
import { OpenRouterProvider } from './providers/openrouter.provider';

import { TeacherStyleRetriever } from './retrieval/teacher-style-retriever.service';

import {
  PaperRepairService,
} from './repair/paper-repair.service';
@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    AiController,
  ],

  providers: [
    AiService,
    PaperGenerationService,
    GeneratedPaperPersistenceService,
    OpenRouterProvider,
    TeacherStyleRetriever,
    PaperRepairService,
    {
      provide: AI_PROVIDER,
      useExisting: OpenRouterProvider,
    },
  ],

  exports: [
    AiService,
    PaperGenerationService,
    GeneratedPaperPersistenceService,
    TeacherStyleRetriever,
  ],
})
export class AiModule {}