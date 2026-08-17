import type {
  GenerationState,
} from '../generation-state';

import {
  generatedPaperSchema,
} from '../../contracts/generated-paper.schema';

import type {
  AiService,
} from '../../ai.service';

import {
  buildPaperGenerationMessages,
} from '../../prompts/paper-generation.prompt';

export async function generatePaperNode(
  state: GenerationState,
  aiService: AiService,
): Promise<GenerationState> {
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
    ...state,
    generatedPaper,
    status: 'VALIDATING',
  };
}