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
});
