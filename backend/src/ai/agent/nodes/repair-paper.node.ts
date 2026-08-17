import type {
  GenerationState,
} from '../generation-state';

import type {
  PaperRepairService,
} from '../../repair/paper-repair.service';

export async function repairPaperNode(
  state: GenerationState,
  paperRepairService:
    PaperRepairService,
): Promise<GenerationState> {
  if (!state.generatedPaper) {
    return {
      ...state,
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
    ...state,

    generatedPaper:
      repairedPaper,

    validationErrors: [],

    repairCount:
      state.repairCount + 1,

    status: 'VALIDATING',
  };
}