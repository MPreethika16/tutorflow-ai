import type {
  GenerationState,
} from '../generation-state';

import {
  validateGeneratedPaper,
} from '../../validation/paper-validator';

export function validatePaperNode(
  state: GenerationState,
): GenerationState {
  if (!state.generatedPaper) {
    return {
      ...state,
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
    ...state,
    validationErrors:
      result.errors,

    status:
      result.valid
        ? 'READY'
        : 'REPAIRING',
  };
}