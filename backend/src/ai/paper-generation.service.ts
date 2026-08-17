import { Injectable } from '@nestjs/common';

import type { GeneratedPaper } from './contracts/generated-paper.schema';
import { generatedPaperSchema } from './contracts/generated-paper.schema';
import { AiService } from './ai.service';
import type { GeneratePaperDto } from './dto/generate-paper.dto';
import { GeneratedPaperPersistenceService } from './generated-paper-persistence.service';
import { buildPaperGenerationMessages } from './prompts/paper-generation.prompt';

import { buildTeacherStyleContext } from './retrieval/teacher-style-context';
import { TeacherStyleRetriever } from './retrieval/teacher-style-retriever.service';

import {
  validateGeneratedPaper,
} from './validation/paper-validator';

import {
  PaperValidationFailedError,
} from './validation/paper-validation.error';

import {
  PaperRepairService,
} from './repair/paper-repair.service';

const MAX_REPAIRS = 2;
@Injectable()
export class PaperGenerationService {
  
  constructor(
  private readonly aiService: AiService,

  private readonly persistenceService:
    GeneratedPaperPersistenceService,

  private readonly teacherStyleRetriever:
    TeacherStyleRetriever,

  private readonly paperRepairService:
    PaperRepairService,
) {}

 async generate(
  dto: GeneratePaperDto,
): Promise<GeneratedPaper> {
  const messages =
    buildPaperGenerationMessages(dto);

  const paper =
    await this.aiService.generateStructured(
      {
        messages,
      },
      generatedPaperSchema,
      'generated_paper',
    );

  return this.validateAndRepair(
    dto,
    paper,
  );
}

  async generateWithTeacherStyle(
  teacherUserId: string,
  dto: GeneratePaperDto,
): Promise<GeneratedPaper> {
  const examples =
    await this.teacherStyleRetriever.retrieve({
      teacherUserId,
      board: dto.board,
      grade: dto.grade,
      subject: dto.subject,
    });

  const teacherStyleContext =
    buildTeacherStyleContext(examples);

  const messages =
    buildPaperGenerationMessages(
      dto,
      teacherStyleContext,
    );

  const paper =
  await this.aiService.generateStructured(
    {
      messages,
    },
    generatedPaperSchema,
    'generated_paper',
  );

return this.validateAndRepair(
  dto,
  paper,
);
}

  async generateAndSaveDraft(
    teacherUserId: string,
    dto: GeneratePaperDto,
  ) {
    const paper =
  await this.generateWithTeacherStyle(
    teacherUserId,
    dto,
  );

    return this.persistenceService.saveDraft(
      teacherUserId,
      dto,
      paper,
    );
  }

  private async validateAndRepair(
  dto: GeneratePaperDto,
  initialPaper: GeneratedPaper,
): Promise<GeneratedPaper> {
  let paper = initialPaper;
  let repairAttempts = 0;

  while (true) {
    const validation =
      validateGeneratedPaper(
        dto,
        paper,
      );

    if (validation.valid) {
      return paper;
    }

    if (
      repairAttempts >=
      MAX_REPAIRS
    ) {
      throw new PaperValidationFailedError(
        validation.errors,
      );
    }

    repairAttempts += 1;

    paper =
      await this.paperRepairService.repair(
        dto,
        paper,
        validation.errors,
      );
  }
}
}