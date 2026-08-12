import { Injectable } from '@nestjs/common';

import type { GeneratedPaper } from './contracts/generated-paper.schema';
import { generatedPaperSchema } from './contracts/generated-paper.schema';
import { AiService } from './ai.service';
import type { GeneratePaperDto } from './dto/generate-paper.dto';
import { GeneratedPaperPersistenceService } from './generated-paper-persistence.service';
import { buildPaperGenerationMessages } from './prompts/paper-generation.prompt';

@Injectable()
export class PaperGenerationService {
  constructor(
    private readonly aiService: AiService,
    private readonly persistenceService: GeneratedPaperPersistenceService,
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

  async generateAndSaveDraft(
    teacherUserId: string,
    dto: GeneratePaperDto,
  ) {
    const paper =
      await this.generate(dto);

    return this.persistenceService.saveDraft(
      teacherUserId,
      dto,
      paper,
    );
  }
}