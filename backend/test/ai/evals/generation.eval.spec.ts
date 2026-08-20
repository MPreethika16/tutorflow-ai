import { GenerationEvalCase } from './datasets/contracts';
import { GENERATION_EVAL_CASES } from './datasets/generation-cases';
import { isSchemaValid, totalMarksCorrectness, requiredTypedFieldsCompletion } from './metrics/generation.metrics';
import { QuestionType } from '../../../src/generated/prisma/client';

describe('Generation Eval Skeleton', () => {
  GENERATION_EVAL_CASES.forEach((evalCase) => {
    it(`demonstrates metric consumption on case: ${evalCase.id}`, () => {
      const mockOutput = {
        questions: [
          { type: QuestionType.TYPED, marks: evalCase.expectedConstraints.totalMarks, modelAnswer: 'ans', gradingInstructions: 'ins' },
        ],
      };

      expect(isSchemaValid(mockOutput)).toBe(true);
      expect(totalMarksCorrectness(mockOutput as any, evalCase.expectedConstraints.totalMarks)).toBe(true);
      expect(requiredTypedFieldsCompletion(mockOutput as any)).toBe(true);
    });
  });
});
