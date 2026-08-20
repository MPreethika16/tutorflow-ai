import { validateAnswerEvaluation } from './answer-evaluation-validator';
import { AnswerEvaluationResult } from '../evaluators/answer-evaluation-result';

describe('validateAnswerEvaluation', () => {
  const validEvaluation: AnswerEvaluationResult = {
    suggestedMarks: 5,
    feedback: 'Good job',
    reasoning: 'Correctly answered',
    confidence: 0.9,
  };

  const maximumMarks = 10;

  it('valid evaluation passes', () => {
    const result = validateAnswerEvaluation(validEvaluation, maximumMarks);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('negative marks fail', () => {
    const result = validateAnswerEvaluation({ ...validEvaluation, suggestedMarks: -1 }, maximumMarks);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'NEGATIVE_MARKS' }));
  });

  it('over-scoring fails', () => {
    const result = validateAnswerEvaluation({ ...validEvaluation, suggestedMarks: 11 }, maximumMarks);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MARKS_EXCEED_MAXIMUM' }));
  });

  it('confidence below 0 fails', () => {
    const result = validateAnswerEvaluation({ ...validEvaluation, confidence: -0.1 }, maximumMarks);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_CONFIDENCE' }));
  });

  it('confidence above 1 fails', () => {
    const result = validateAnswerEvaluation({ ...validEvaluation, confidence: 1.1 }, maximumMarks);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_CONFIDENCE' }));
  });

  it('empty feedback fails', () => {
    const result = validateAnswerEvaluation({ ...validEvaluation, feedback: '   ' }, maximumMarks);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'EMPTY_FEEDBACK' }));
  });

  it('whitespace reasoning fails', () => {
    const result = validateAnswerEvaluation({ ...validEvaluation, reasoning: '\n' }, maximumMarks);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'EMPTY_REASONING' }));
  });

  it('multiple failures return multiple errors', () => {
    const result = validateAnswerEvaluation(
      {
        suggestedMarks: 15,
        feedback: '  ',
        reasoning: '',
        confidence: -1,
      },
      maximumMarks,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(4);
    const codes = result.errors.map(e => e.code);
    expect(codes).toContain('MARKS_EXCEED_MAXIMUM');
    expect(codes).toContain('EMPTY_FEEDBACK');
    expect(codes).toContain('EMPTY_REASONING');
    expect(codes).toContain('INVALID_CONFIDENCE');
  });

  describe('criteria validation', () => {
    const evalWithCriteria: AnswerEvaluationResult = {
      ...validEvaluation,
      criteria: [
        { criterion: 'C1', awardedMarks: 2, maxMarks: 5, status: 'PARTIAL' },
        { criterion: 'C2', awardedMarks: 3, maxMarks: 5, status: 'MET' },
      ],
    };

    it('passes with valid criteria', () => {
      const result = validateAnswerEvaluation(evalWithCriteria, maximumMarks);
      expect(result.valid).toBe(true);
    });

    it('fails if awardedMarks < 0', () => {
      const badEval = {
        ...evalWithCriteria,
        criteria: [{ criterion: 'C1', awardedMarks: -1, maxMarks: 10, status: 'NOT_MET' as const }],
      };
      const result = validateAnswerEvaluation(badEval, maximumMarks);
      expect(result.valid).toBe(false);
      expect(result.errors.map(e => e.code)).toContain('NEGATIVE_MARKS');
    });

    it('fails if awardedMarks > maxMarks', () => {
      const badEval = {
        ...evalWithCriteria,
        criteria: [
          { criterion: 'C1', awardedMarks: 6, maxMarks: 5, status: 'MET' as const },
          { criterion: 'C2', awardedMarks: 0, maxMarks: 5, status: 'NOT_MET' as const },
        ],
        suggestedMarks: 6,
      };
      const result = validateAnswerEvaluation(badEval, maximumMarks);
      expect(result.valid).toBe(false);
      expect(result.errors.map(e => e.code)).toContain('MARKS_EXCEED_MAXIMUM');
    });

    it('fails if sum of criteria max marks does not equal question maximum marks', () => {
      const badEval = {
        ...evalWithCriteria,
        criteria: [
          { criterion: 'C1', awardedMarks: 2, maxMarks: 4, status: 'PARTIAL' as const },
          { criterion: 'C2', awardedMarks: 3, maxMarks: 4, status: 'MET' as const },
        ],
      };
      const result = validateAnswerEvaluation(badEval, maximumMarks);
      expect(result.valid).toBe(false);
      expect(result.errors.map(e => e.code)).toContain('MAX_MARKS_MISMATCH');
    });

    it('fails if sum of criteria awarded marks does not equal suggestedMarks', () => {
      const badEval = {
        ...evalWithCriteria,
        suggestedMarks: 10,
      };
      const result = validateAnswerEvaluation(badEval, maximumMarks);
      expect(result.valid).toBe(false);
      expect(result.errors.map(e => e.code)).toContain('MARKS_MISMATCH');
    });

    it('fails on duplicate criteria', () => {
      const badEval = {
        ...evalWithCriteria,
        criteria: [
          { criterion: 'C1', awardedMarks: 2, maxMarks: 5, status: 'PARTIAL' as const },
          { criterion: 'C1', awardedMarks: 3, maxMarks: 5, status: 'MET' as const },
        ],
      };
      const result = validateAnswerEvaluation(badEval, maximumMarks);
      expect(result.valid).toBe(false);
      expect(result.errors.map(e => e.code)).toContain('DUPLICATE_CRITERION');
    });
  });
});
