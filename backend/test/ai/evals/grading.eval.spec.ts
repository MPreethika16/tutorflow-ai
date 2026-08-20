import { GradingEvalCase } from './datasets/contracts';
import { GRADING_EVAL_CASES } from './datasets/grading-cases';
import { marksWithinExpectedRange, scoreBoundsValid } from './metrics/grading.metrics';

describe('Grading Eval Skeleton', () => {
  GRADING_EVAL_CASES.forEach((evalCase) => {
    it(`demonstrates metric consumption on case: ${evalCase.id}`, () => {
      // Dummy mock taking from expected range or marks
      const mockAiSuggestedMarks = evalCase.expectedMarks ?? (evalCase.expectedRange ? evalCase.expectedRange[0] : 0);

      if (evalCase.expectedRange) {
        expect(marksWithinExpectedRange(mockAiSuggestedMarks, evalCase.expectedRange)).toBe(true);
      }
      expect(scoreBoundsValid(mockAiSuggestedMarks, evalCase.question.marks)).toBe(true);
    });
  });
});
