import { RetrievalEvalCase } from './datasets/contracts';
import { RETRIEVAL_EVAL_CASES } from './datasets/retrieval-cases';
import { recallAtK, rejectionAccuracy } from './metrics/retrieval.metrics';

describe('Retrieval Eval Skeleton', () => {
  RETRIEVAL_EVAL_CASES.forEach((evalCase) => {
    it(`demonstrates metric consumption on case: ${evalCase.id}`, () => {
      const mockResults = evalCase.expectedPromptFragment
        ? [{ prompt: evalCase.expectedPromptFragment }]
        : [];

      if (evalCase.expectedPromptFragment) {
        expect(recallAtK(mockResults, evalCase.expectedPromptFragment, 1)).toBe(true);
      }
      expect(rejectionAccuracy(mockResults, !!evalCase.shouldReject)).toBe(true);
    });
  });
});
