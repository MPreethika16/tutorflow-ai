import { Injectable } from '@nestjs/common';

import {
  generatedPaperSchema,
  type GeneratedPaper,
} from '../contracts/generated-paper.schema';

import { AiService } from '../ai.service';
import type {
  GeneratePaperDto,
} from '../dto/generate-paper.dto';
import type {
  PaperValidationError,
} from '../validation/paper-validation.types';

import {
  buildPaperRepairMessages,
} from './paper-repair.prompt';

@Injectable()
export class PaperRepairService {
  constructor(
    private readonly aiService: AiService,
  ) {}

  repair(
    request: GeneratePaperDto,
    paper: GeneratedPaper,
    errors: PaperValidationError[],
  ): Promise<GeneratedPaper> {
    const messages =
      buildPaperRepairMessages(
        request,
        paper,
        errors,
      );

    return this.aiService.generateStructured(
      {
        messages,
      },
      generatedPaperSchema,
      'generated_paper',
    );
  }
}