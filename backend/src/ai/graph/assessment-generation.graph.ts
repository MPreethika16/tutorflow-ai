import {
  END,
  START,
  StateGraph,
  StateSchema,
} from '@langchain/langgraph';

import { z } from 'zod';

import { Logger } from '@nestjs/common';

import { AiProviderError } from '../errors/ai-provider.error';
import {
  GenerationObservabilityHelper,
  classifyLatency,
} from './generation-observability.helper';


import {
  generatedPaperSchema,
} from '../contracts/generated-paper.schema';

import type {
  AiService,
} from '../ai.service';

import {
  buildPaperGenerationMessages,
} from '../prompts/paper-generation.prompt';

import {
  buildTeacherStyleContext,
} from '../retrieval/teacher-style-context';

import type {
  TeacherStyleRetriever,
} from '../retrieval/teacher-style-retriever.service';

import type {
  PaperRepairService,
} from '../repair/paper-repair.service';

import {
  validateGeneratedPaper,
} from '../validation/paper-validator';

import type {
  GeneratedPaperPersistenceService,
} from '../generated-paper-persistence.service';

const validationErrorCodeSchema =
  z.enum([
    'TOTAL_MARKS_MISMATCH',
    'NO_QUESTIONS',
    'DUPLICATE_QUESTION',
    'MCQ_INVALID_CORRECT_OPTION',
    'MISSING_MODEL_ANSWER',
    'MISSING_GRADING_INSTRUCTIONS',
    'DURATION_MISMATCH',
  ]);

const persistedAssessmentSchema =
  z.object({
    assessmentId:
      z.string(),

    kind:
      z.enum([
        'PRACTICE',
        'TEST',
      ]),

    source:
      z.string(),

    status:
      z.string(),

    title:
      z
        .string()
        .optional(),

    maximumMarks:
      z
        .number()
        .optional(),

    durationMinutes:
  z
    .number()
    .nullable()
    .optional(),
  });

const GraphState =
  new StateSchema({
    teacherUserId:
      z.string(),

    request: z.object({
      board:
        z.string(),

      grade:
        z.string(),

      subject:
        z.string(),

      topic:
        z.string(),

      kind:
        z.enum([
          'PRACTICE',
          'TEST',
        ]),

      totalMarks:
        z.number(),

      durationMinutes:
        z.number(),

      additionalInstructions:
        z
          .string()
          .optional(),
    }),

    teacherContext:
      z
        .string()
        .default(''),

    generatedPaper:
      generatedPaperSchema
        .optional(),

    validationErrors:
      z
        .array(
          z.object({
            code:
              validationErrorCodeSchema,

            message:
              z.string(),

            questionIndex:
              z
                .number()
                .optional(),
          }),
        )
        .default([]),

    repairCount:
      z
        .number()
        .default(0),

    providerAttempts:
      z
        .number()
        .default(0),

    lastProviderErrorCode:
      z
        .string()
        .nullable()
        .default(null),

    status:
      z
        .enum([
          'PENDING',
          'GENERATING',
          'VALIDATING',
          'REPAIRING',
          'READY',
          'PERSISTING',
          'COMPLETED',
          'FAILED',
        ])
        .default('PENDING'),

    persistedAssessment:
      persistedAssessmentSchema
        .optional(),
  });

// ----------------------------------------------------------------
// Provider-level retry policy
// Domain validation failures use the repair node — not this.
// ----------------------------------------------------------------

const RETRYABLE_PROVIDER_ERRORS = new Set([
  'INVALID_RESPONSE',
  'TIMEOUT',
  'UNAVAILABLE',
  'RATE_LIMIT',
]);

const MAX_PROVIDER_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildAssessmentGenerationGraph(
  aiService: AiService,

  teacherStyleRetriever:
    TeacherStyleRetriever,

  paperRepairService:
    PaperRepairService,

  persistenceService:
    GeneratedPaperPersistenceService,

  logger: Logger = new Logger('AssessmentGenerationGraph'),
) {
  const obs = new GenerationObservabilityHelper(logger);
  // --------------------------------
  // RETRIEVE
  // --------------------------------

  const retrieveNode:
    typeof GraphState.Node =
    async (state) => {
      const examples =
        await teacherStyleRetriever.retrieve({
          teacherUserId:
            state.teacherUserId,

          board:
            state.request.board,

          grade:
            state.request.grade,

          subject:
            state.request.subject,
        });

      return {
        teacherContext:
          buildTeacherStyleContext(
            examples,
          ),
      };
    };

  // --------------------------------
  // GENERATE
  // --------------------------------

  const generateNode:
    typeof GraphState.Node =
    async (state) => {
      const messages =
        buildPaperGenerationMessages(
          state.request,
          state.teacherContext,
        );

      const { subject, board, grade, totalMarks } = state.request;
      const startMs = Date.now();
      let lastError: AiProviderError | null = null;

      for (
        let attempt = 1;
        attempt <= MAX_PROVIDER_ATTEMPTS;
        attempt++
      ) {
        // Fixed delay for rate-limit only — avoids hammering the provider.
        if (lastError?.code === 'RATE_LIMIT') {
          await sleep(2000);
        }

        obs.logAttemptStart({ subject, board, grade, totalMarks, attempt, maxAttempts: MAX_PROVIDER_ATTEMPTS });

        try {
          const generatedPaper =
            await aiService.generateStructured(
              { messages },
              generatedPaperSchema,
              'generated_paper',
            );

          return {
            generatedPaper,
            status: 'VALIDATING',
            providerAttempts: attempt,
            lastProviderErrorCode: null,
          };
        } catch (error: unknown) {
          if (
            error instanceof AiProviderError &&
            RETRYABLE_PROVIDER_ERRORS.has(error.code)
          ) {
            lastError = error;
            const willRetry = attempt < MAX_PROVIDER_ATTEMPTS;
            obs.logAttemptFailure({ subject, board, grade, totalMarks, attempt, maxAttempts: MAX_PROVIDER_ATTEMPTS, errorCode: error.code, willRetry });
            continue;
          }
          // Non-retryable (AUTHENTICATION, CONFIGURATION, UNKNOWN) — propagate immediately.
          if (error instanceof AiProviderError) {
            obs.logAttemptFailure({ subject, board, grade, totalMarks, attempt, maxAttempts: MAX_PROVIDER_ATTEMPTS, errorCode: error.code, willRetry: false });
          }
          throw error;
        }
      }

      // All attempts exhausted.
      obs.logProviderExhausted({ subject, board, grade, maxAttempts: MAX_PROVIDER_ATTEMPTS, errorCode: lastError!.code });
      obs.logOutcome({
        subject, board, grade, totalMarks,
        providerAttempts: MAX_PROVIDER_ATTEMPTS,
        repairCount: state.repairCount,
        elapsedMs: Date.now() - startMs,
        latencyClassification: classifyLatency(Date.now() - startMs),
        outcome: 'PROVIDER_EXHAUSTED',
      });
      throw lastError!;
    };

  // --------------------------------
  // VALIDATE
  // --------------------------------

  const validateNode:
    typeof GraphState.Node =
    async (state) => {
      if (!state.generatedPaper) {
        return {
          validationErrors: [],
          status: 'FAILED',
        };
      }

      const result =
        validateGeneratedPaper(
          state.request,
          state.generatedPaper,
        );

      return {
        validationErrors:
          result.errors,

        status:
          result.valid
            ? 'READY'
            : 'REPAIRING',
      };
    };

  // --------------------------------
  // REPAIR
  // --------------------------------

  const repairNode:
    typeof GraphState.Node =
    async (state) => {
      if (!state.generatedPaper) {
        return {
          status: 'FAILED',
        };
      }

      const errorCodes = state.validationErrors.map((e) => e.code);
      obs.logDomainRepair(state.request.subject, state.repairCount + 1, errorCodes);

      const repairedPaper =
        await paperRepairService.repair(
          state.request,
          state.generatedPaper,
          state.validationErrors,
        );

      return {
        generatedPaper:
          repairedPaper,

        validationErrors: [],

        repairCount:
          state.repairCount + 1,

        status: 'VALIDATING',
      };
    };

    const failNode:
  typeof GraphState.Node =
  async () => {
    return {
      status: 'FAILED',
    };
  };

  const persistNode:
  typeof GraphState.Node =
  async (state) => {
    if (!state.generatedPaper) {
      return {
        status: 'FAILED',
      };
    }

    const persistedAssessment =
      await persistenceService.saveDraft(
        state.teacherUserId,
        state.request,
        state.generatedPaper,
      );

    return {
      persistedAssessment: {
        assessmentId:
          persistedAssessment.assessmentId,

        kind:
          persistedAssessment.kind,

        source:
          persistedAssessment.source,

        status:
          persistedAssessment.status,

        title:
          persistedAssessment.title,

        maximumMarks:
          persistedAssessment.maximumMarks,

        durationMinutes:
          persistedAssessment.durationMinutes,
      },

      status: 'COMPLETED',
    };
  };


 
  // --------------------------------
  // ROUTER
  // --------------------------------

  const routeAfterValidation = (
    state:
      typeof GraphState.State,
  ):
    | 'complete'
    | 'repair'
    | 'failed' => {
    if (
      state.status === 'READY'
    ) {
      return 'complete';
    }

    if (
      state.status ===
        'REPAIRING' &&
      state.repairCount < 2
    ) {
      return 'repair';
    }

    return 'failed';
  };

  // --------------------------------
  // GRAPH
  // --------------------------------

  return new StateGraph(
    GraphState,
  )
    .addNode(
      'retrieve',
      retrieveNode,
    )

    .addNode(
      'generate',
      generateNode,
    )

    .addNode(
      'validate',
      validateNode,
    )

    .addNode(
      'repair',
      repairNode,
    )

    .addNode(
        'fail',
        failNode,
    )

    .addNode(
    'persist',
    persistNode,
    )
    .addEdge(
      START,
      'retrieve',
    )

    .addEdge(
      'retrieve',
      'generate',
    )

    .addEdge(
      'generate',
      'validate',
    )

    .addConditionalEdges(
        'validate',
        routeAfterValidation,
        {
            complete: 'persist',
            repair: 'repair',
            failed: 'fail',
        },
    )

    .addEdge(
      'repair',
      'validate',
    )

    .addEdge(
    'fail',
    END,
    )

    .addEdge(
        'persist',
        END,
        )

    

    .compile();
}