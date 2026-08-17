import {
  END,
  START,
  StateGraph,
  StateSchema,
} from '@langchain/langgraph';

import { z } from 'zod';

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
  });

export function buildAssessmentGenerationGraph(
  aiService: AiService,

  teacherStyleRetriever:
    TeacherStyleRetriever,

  paperRepairService:
    PaperRepairService,

  persistenceService:
    GeneratedPaperPersistenceService,
) {
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

      const generatedPaper =
        await aiService.generateStructured(
          {
            messages,
          },

          generatedPaperSchema,

          'generated_paper',
        );

      return {
        generatedPaper,
        status: 'VALIDATING',
      };
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

    await persistenceService.saveDraft(
      state.teacherUserId,
      state.request,
      state.generatedPaper,
    );

    return {
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