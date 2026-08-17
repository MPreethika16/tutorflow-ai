import type {
  GenerationState,
} from './generation-state';

export type GenerationRoute =
  | 'PERSIST'
  | 'REPAIR'
  | 'FAIL';

const MAX_REPAIRS = 2;

export function routeAfterValidation(
  state: GenerationState,
): GenerationRoute {
  if (state.status === 'READY') {
    return 'PERSIST';
  }

  if (
    state.status === 'REPAIRING' &&
    state.repairCount < MAX_REPAIRS
  ) {
    return 'REPAIR';
  }

  return 'FAIL';
}