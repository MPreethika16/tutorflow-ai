import { Injectable } from '@nestjs/common';

import type { GeneratedPaper } from './contracts/generated-paper.schema';
import { generatedPaperSchema } from './contracts/generated-paper.schema';
import { AiService } from './ai.service';
import type { GeneratePaperDto } from './dto/generate-paper.dto';
import { buildPaperGenerationMessages } from './prompts/paper-generation.prompt';

@Injectable()
export class PaperGenerationService {
  constructor(
    private readonly aiService: AiService,
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
}