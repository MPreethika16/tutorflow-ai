import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeneratedPaperPersistenceService } from './generated-paper-persistence.service';
import { PaperGenerationService } from './paper-generation.service';
import { EmbeddingService } from './embedding.service';
import { QuestionEmbeddingService } from './question-embedding.service';
import { EmbeddingBackfillService } from './embedding-backfill.service';
import { SemanticQuestionSearchService } from './semantic-question-search.service';
import { AI_PROVIDER } from './providers/ai-provider.token';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { EMBEDDING_PROVIDER } from './providers/embedding-provider.token';
import { OpenRouterEmbeddingProvider } from './providers/openrouter-embedding.provider';

import { TeacherStyleRetriever } from './retrieval/teacher-style-retriever.service';

import {
  PaperRepairService,
} from './repair/paper-repair.service';

import {
  GenerationWorkflowService,
} from './graph/generation-workflow.service';

import { McqEvaluatorService } from './evaluators/mcq-evaluator.service';
import { TypedEvaluatorService } from './evaluators/typed-evaluator.service';
import { AnswerEvaluationService } from './evaluators/answer-evaluation.service';
import { AnswerEvaluationPersistenceService } from './evaluators/answer-evaluation-persistence.service';


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
    EmbeddingService,
    QuestionEmbeddingService,
    EmbeddingBackfillService,
    SemanticQuestionSearchService,
    GeneratedPaperPersistenceService,
    OpenRouterProvider,
    TeacherStyleRetriever,
    PaperRepairService,
    GenerationWorkflowService,
    McqEvaluatorService,
    TypedEvaluatorService,
    AnswerEvaluationService,
    AnswerEvaluationPersistenceService,
    {
      provide: AI_PROVIDER,
      useExisting: OpenRouterProvider,
    },
    OpenRouterEmbeddingProvider,
    {
      provide: EMBEDDING_PROVIDER,
      useExisting: OpenRouterEmbeddingProvider,
    },
  ],

  exports: [
    AiService,
    PaperGenerationService,
    EmbeddingService,
    QuestionEmbeddingService,
    EmbeddingBackfillService,
    SemanticQuestionSearchService,
    GeneratedPaperPersistenceService,
    TeacherStyleRetriever,
    GenerationWorkflowService,
    McqEvaluatorService,
    TypedEvaluatorService,
    AnswerEvaluationService,
    AnswerEvaluationPersistenceService,
    EMBEDDING_PROVIDER,
  ],
})
export class AiModule {}