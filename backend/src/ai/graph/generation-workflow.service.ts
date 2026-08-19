import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import type {
  GeneratePaperDto,
} from '../dto/generate-paper.dto';

import { AiService } from '../ai.service';
import {
  GeneratedPaperPersistenceService,
} from '../generated-paper-persistence.service';
import {
  PaperRepairService,
} from '../repair/paper-repair.service';
import {
  TeacherStyleRetriever,
} from '../retrieval/teacher-style-retriever.service';

import {
  buildAssessmentGenerationGraph,
} from './assessment-generation.graph';

@Injectable()
export class GenerationWorkflowService {
  private readonly graph;

  constructor(
    aiService: AiService,

    teacherStyleRetriever:
      TeacherStyleRetriever,

    paperRepairService:
      PaperRepairService,

    persistenceService:
      GeneratedPaperPersistenceService,
  ) {
    this.graph =
      buildAssessmentGenerationGraph(
        aiService,
        teacherStyleRetriever,
        paperRepairService,
        persistenceService,
      );
  }

  async run(
    teacherUserId: string,
    request: GeneratePaperDto,
  ) {
    const result =
      await this.graph.invoke({
        teacherUserId,
        request,
      });

    if (
      result.status !== 'COMPLETED' ||
      !result.persistedAssessment
    ) {
      throw new InternalServerErrorException(
        'AI paper generation workflow failed',
      );
    }

    return result.persistedAssessment;
  }
}