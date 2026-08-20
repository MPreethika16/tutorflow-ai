import { isSchemaValid, totalMarksCorrectness, requiredTypedFieldsCompletion } from './generation.metrics';
import { QuestionType } from '../../../../src/generated/prisma/client';

describe('Generation Metrics', () => {
  describe('isSchemaValid', () => {
    it('returns true for an object with a questions array', () => {
      expect(isSchemaValid({ questions: [] })).toBe(true);
    });
    it('returns false for null or undefined', () => {
      expect(isSchemaValid(null)).toBe(false);
      expect(isSchemaValid(undefined)).toBe(false);
    });
    it('returns false for an object without a questions array', () => {
      expect(isSchemaValid({})).toBe(false);
      expect(isSchemaValid({ questions: 'string' })).toBe(false);
    });
  });

  describe('totalMarksCorrectness', () => {
    it('returns true when sum matches expected', () => {
      const paper: any = { questions: [{ marks: 5 }, { marks: 5 }] };
      expect(totalMarksCorrectness(paper, 10)).toBe(true);
    });
    it('returns false for incorrect total marks', () => {
      const paper: any = { questions: [{ marks: 5 }, { marks: 4 }] };
      expect(totalMarksCorrectness(paper, 10)).toBe(false);
    });
  });

  describe('requiredTypedFieldsCompletion', () => {
    it('returns true when valid mixed MCQ/TYPED paper', () => {
      const paper: any = {
        questions: [
          { type: QuestionType.MCQ },
          { type: QuestionType.TYPED, modelAnswer: 'ans', gradingInstructions: 'ins' },
        ],
      };
      expect(requiredTypedFieldsCompletion(paper)).toBe(true);
    });
    it('returns false for missing modelAnswer', () => {
      const paper: any = {
        questions: [{ type: QuestionType.TYPED, modelAnswer: '', gradingInstructions: 'ins' }],
      };
      expect(requiredTypedFieldsCompletion(paper)).toBe(false);
    });
    it('returns false for missing gradingInstructions', () => {
      const paper: any = {
        questions: [{ type: QuestionType.TYPED, modelAnswer: 'ans' }],
      };
      expect(requiredTypedFieldsCompletion(paper)).toBe(false);
    });
  });
});
