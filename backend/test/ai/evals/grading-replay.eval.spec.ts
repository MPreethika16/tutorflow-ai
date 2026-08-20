import { runReplayEval } from './run-grading-replay.runner';
import { GradingEvalCase } from './datasets/contracts';
import { GradingCapture } from './datasets/grading-replay.fixture';

describe('Grading Replay Evaluation Logic', () => {
  const dummyCase: GradingEvalCase = {
    id: 'test-case-1',
    description: 'test case',
    question: { marks: 5 } as any,
    studentAnswer: { textAnswer: 'foo' } as any,
    expectedRange: [3, 5],
  };

  const validResult = {
    suggestedMarks: 4,
    criteria: [
      { criterion: 'c1', awardedMarks: 4, maxMarks: 5, status: 'PARTIAL' as const }
    ],
    feedback: 'good',
    reasoning: 'good',
    confidence: 1,
  };

  const validCapture: GradingCapture = {
    caseId: 'test-case-1',
    result: validResult,
    captureMetadata: { capturedAt: 'now', datasetVersion: 'grading-v1.1', captureSource: 'LLM' },
  };

  it('evaluates successfully with zero AI calls or DB calls', () => {
    const result = runReplayEval([dummyCase], [validCapture]);
    expect(result.totalCases).toBe(1);
    expect(result.successful).toBe(1);
    expect(result.missingCaptures).toBe(0);
    expect(result.validationFailures).toBe(0);
    expect(result.totalCaptures).toBe(1);
    expect(result.llmCaptures).toBe(1);
    expect(result.bypassCaptures).toBe(0);
    expect(result.rangePasses).toBe(1);
    expect(result.boundsPasses).toBe(1);
    expect(result.criteriaMathPasses).toBe(1);
  });

  it('reports missing captures without fabricating them', () => {
    const result = runReplayEval([dummyCase], []);
    expect(result.totalCases).toBe(1);
    expect(result.successful).toBe(0);
    expect(result.missingCaptures).toBe(1);
  });

  it('rejects rubric-math-invalid captures', () => {
    const invalidMathCapture: GradingCapture = {
      caseId: 'test-case-1',
      result: {
        ...validResult,
        suggestedMarks: 5, // mismatch with sum of awardedMarks (4)
      },
      captureMetadata: { capturedAt: 'now', datasetVersion: 'grading-v1.1', captureSource: 'DETERMINISTIC_BYPASS' },
    };
    
    const result = runReplayEval([dummyCase], [invalidMathCapture]);
    expect(result.totalCases).toBe(1);
    expect(result.successful).toBe(0);
    expect(result.validationFailures).toBe(1);
    expect(result.perCaseReports[0]).toContain('[VALIDATION FAIL]');
  });
});
