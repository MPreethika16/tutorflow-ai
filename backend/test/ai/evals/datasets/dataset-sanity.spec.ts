import { GENERATION_EVAL_CASES } from './generation-cases';
import { GRADING_EVAL_CASES } from './grading-cases';
import { RETRIEVAL_EVAL_CASES } from './retrieval-cases';

describe('Dataset Sanity Tests', () => {
  it('Generation Dataset Sanity', () => {
    const ids = new Set();
    GENERATION_EVAL_CASES.forEach((c) => {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.expectedConstraints.totalMarks).toBeGreaterThan(0);
    });
  });

  it('Grading Dataset Sanity', () => {
    const ids = new Set();
    GRADING_EVAL_CASES.forEach((c) => {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      if (c.expectedRange) {
        expect(c.expectedRange[0]).toBeLessThanOrEqual(c.expectedRange[1]);
        if (c.expectedMarks !== undefined) {
          expect(c.expectedMarks).toBeGreaterThanOrEqual(c.expectedRange[0]);
          expect(c.expectedMarks).toBeLessThanOrEqual(c.expectedRange[1]);
        }
      }
    });
  });

  it('Retrieval Dataset Sanity', () => {
    const ids = new Set();
    let rejectCasesCount = 0;
    RETRIEVAL_EVAL_CASES.forEach((c) => {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      if (c.shouldReject) {
        expect(c.expectedPromptFragment).toBeNull();
        rejectCasesCount++;
      }
    });
    expect(rejectCasesCount).toBeGreaterThanOrEqual(2);
  });
});
