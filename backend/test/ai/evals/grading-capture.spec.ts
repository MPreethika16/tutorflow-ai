import * as fs from 'fs';
import { attemptCapture, CURRENT_DATASET_VERSION } from './capture-helper';
import { GradingEvalCase } from './datasets/contracts';
import { AnswerEvaluationResult } from '../../../src/ai/evaluators/answer-evaluation-result';

jest.mock('fs');

describe('Grading Capture Logic', () => {
  const dummyCase: GradingEvalCase = {
    id: 'test-case-1',
    description: 'test case',
    question: { marks: 5 } as any,
    studentAnswer: { textAnswer: 'foo' } as any,
    expectedRange: [3, 5],
  };

  const validResult: AnswerEvaluationResult = {
    suggestedMarks: 5,
    criteria: [
      { criterion: 'c1', awardedMarks: 5, maxMarks: 5, status: 'MET' }
    ],
    feedback: 'good',
    reasoning: 'good',
    confidence: 1,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('saves only successful accepted evaluations', () => {
    const captures: any[] = [];
    const outcome = attemptCapture(dummyCase, validResult, captures, 'dummy.json');
    
    expect(outcome.captured).toBe(true);
    expect(captures.length).toBe(1);
    expect(captures[0].caseId).toBe('test-case-1');
    expect(captures[0].captureMetadata.captureSource).toBe('LLM');
    expect(fs.writeFileSync).toHaveBeenCalledWith('dummy.json', expect.any(String), 'utf8');
  });

  it('existing captures are not silently overwritten', () => {
    const captures: any[] = [{ caseId: 'test-case-1' }];
    const outcome = attemptCapture(dummyCase, validResult, captures, 'dummy.json');
    
    expect(outcome.captured).toBe(false);
    expect(outcome.skipped).toBe(true);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('invalid rubric math is never captured', () => {
    const captures: any[] = [];
    const invalidResult = { ...validResult, suggestedMarks: 4 }; // invalid math
    
    const outcome = attemptCapture(dummyCase, invalidResult, captures, 'dummy.json');
    
    expect(outcome.captured).toBe(false);
    expect(outcome.validationFailures).toBe(1);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(captures.length).toBe(0);
  });
});
