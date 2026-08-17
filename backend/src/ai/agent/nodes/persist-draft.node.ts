import type {
  GenerationState,
} from '../generation-state';

import type {
  GeneratedPaperPersistenceService,
} from '../../generated-paper-persistence.service';

export async function persistDraftNode(
  state: GenerationState,
  persistenceService:
    GeneratedPaperPersistenceService,
) {
  if (!state.generatedPaper) {
    throw new Error(
      'Cannot persist without a generated paper',
    );
  }

  return persistenceService.saveDraft(
    state.teacherUserId,
    state.request,
    state.generatedPaper,
  );
}