import type {
  GeneratePaperDto,
} from '../dto/generate-paper.dto';

import type {
  AiService,
} from '../ai.service';

import type {
  TeacherStyleRetriever,
} from '../retrieval/teacher-style-retriever.service';

import type {
  PaperRepairService,
} from '../repair/paper-repair.service';

import type {
  GeneratedPaperPersistenceService,
} from '../generated-paper-persistence.service';

import type {
  GenerationState,
} from './generation-state';

import {
  retrieveStyleNode,
} from './nodes/retrieve-style.node';

import {
  generatePaperNode,
} from './nodes/generate-paper.node';

import {
  validatePaperNode,
} from './nodes/validate-paper.node';

import {
  repairPaperNode,
} from './nodes/repair-paper.node';

import {
  persistDraftNode,
} from './nodes/persist-draft.node';

import {
  routeAfterValidation,
} from './generation-router';

export class GenerationAgent {
  constructor(
    private readonly aiService: AiService,

    private readonly teacherStyleRetriever:
      TeacherStyleRetriever,

    private readonly paperRepairService:
      PaperRepairService,

    private readonly persistenceService:
      GeneratedPaperPersistenceService,
  ) {}

  async run(
    teacherUserId: string,
    request: GeneratePaperDto,
  ) {
    let state: GenerationState = {
      request,
      teacherUserId,

      teacherContext: '',

      generatedPaper: undefined,

      validationErrors: [],

      repairCount: 0,

      status: 'PENDING',
    };

    // 1. Retrieve teacher style
    state =
      await retrieveStyleNode(
        state,
        this.teacherStyleRetriever,
      );

    // 2. Generate paper
    state =
      await generatePaperNode(
        {
          ...state,
          status: 'GENERATING',
        },
        this.aiService,
      );

    // 3. Validate
    state =
      validatePaperNode(state);

    while (true) {
      const route =
        routeAfterValidation(state);

      if (route === 'PERSIST') {
        return persistDraftNode(
          state,
          this.persistenceService,
        );
      }

      if (route === 'FAIL') {
        throw new Error(
          'Generation workflow failed after maximum repair attempts',
        );
      }

      // route === REPAIR
      state =
        await repairPaperNode(
          state,
          this.paperRepairService,
        );

      state =
        validatePaperNode(state);
    }
  }
}