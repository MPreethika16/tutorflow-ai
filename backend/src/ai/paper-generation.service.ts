import { Injectable } from '@nestjs/common';

import type { GeneratedPaper } from './contracts/generated-paper.schema';
import { generatedPaperSchema } from './contracts/generated-paper.schema';
import { AiService } from './ai.service';
import type { GeneratePaperDto } from './dto/generate-paper.dto';
import { GeneratedPaperPersistenceService } from './generated-paper-persistence.service';
import { buildPaperGenerationMessages } from './prompts/paper-generation.prompt';

import { buildTeacherStyleContext } from './retrieval/teacher-style-context';
import { TeacherStyleRetriever } from './retrieval/teacher-style-retriever.service';
@Injectable()
export class PaperGenerationService {
  constructor(
    private readonly aiService: AiService,
    private readonly persistenceService: GeneratedPaperPersistenceService,
     private readonly teacherStyleRetriever: TeacherStyleRetriever,
  ) {}

  generate(
    dto: GeneratePaperDto,
  ): Promise<GeneratedPaper> {
    const messages =
      buildPaperGenerationMessages(dto);

    return this.aiService.generateStructured(
      {
        messages,
      },
      generatedPaperSchema,
      'generated_paper',
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

  return this.aiService.generateStructured(
    {
      messages,
    },
    generatedPaperSchema,
    'generated_paper',
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
}