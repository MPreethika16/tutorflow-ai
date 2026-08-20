import { GradingEvalCase } from './datasets/contracts';
import { GradingCapture } from './datasets/grading-replay.fixture';
import { validateAnswerEvaluation } from '../../../src/ai/validation/answer-evaluation-validator';
import { marksWithinExpectedRange, scoreBoundsValid, absoluteMarkError } from './metrics/grading.metrics';

export interface ReplayEvalResult {
  totalCases: number;
  successful: number;
  missingCaptures: number;
  validationFailures: number;
  totalCaptures: number;
  llmCaptures: number;
  bypassCaptures: number;
  rangePasses: number;
  boundsPasses: number;
  criteriaMathPasses: number;
  totalMarkError: number;
  markErrorCount: number;

  llmRangePasses: number;
  llmBoundsPasses: number;
  llmCriteriaMathPasses: number;
  llmTotalMarkError: number;
  llmMarkErrorCount: number;

  perCaseReports: string[];
}

export function runReplayEval(cases: GradingEvalCase[], captures: GradingCapture[]): ReplayEvalResult {
  const totalCases = cases.length;
  let successful = 0;
  let missingCaptures = 0;
  let validationFailures = 0;
  let totalCapturesCount = 0;
  let llmCaptures = 0;
  let bypassCaptures = 0;
  let rangePasses = 0;
  let boundsPasses = 0;
  let totalMarkError = 0;
  let markErrorCount = 0;
  let criteriaMathPasses = 0;

  let llmRangePasses = 0;
  let llmBoundsPasses = 0;
  let llmTotalMarkError = 0;
  let llmMarkErrorCount = 0;
  let llmCriteriaMathPasses = 0;

  const perCaseReports: string[] = [];

  for (const tc of cases) {
    const capture = captures.find((c) => c.caseId === tc.id);

    if (!capture) {
      perCaseReports.push(`[MISSING CAPTURE] ${tc.id.padEnd(20)} - No captured output available.`);
      missingCaptures++;
      continue;
    }

    const result = capture.result;
    totalCapturesCount++;

    if (capture.captureMetadata?.captureSource === 'LLM') {
      llmCaptures++;
    } else if (capture.captureMetadata?.captureSource === 'DETERMINISTIC_BYPASS') {
      bypassCaptures++;
    }
    
    // 1. Validate structure/math deterministically without hitting DB
    const validation = validateAnswerEvaluation(result, tc.question.marks);
    if (!validation.valid) {
      perCaseReports.push(`[VALIDATION FAIL] ${tc.id.padEnd(20)} - captured result violates deterministic rules: ${validation.errors.map(e => e.code).join(', ')}`);
      validationFailures++;
      continue;
    }
    criteriaMathPasses++;
    if (capture.captureMetadata?.captureSource === 'LLM') {
      llmCriteriaMathPasses++;
    }

    // 2. Metrics
    const inRange = tc.expectedRange
      ? marksWithinExpectedRange(result.suggestedMarks, tc.expectedRange)
      : true;
    const inBounds = scoreBoundsValid(result.suggestedMarks, tc.question.marks);

    if (inRange && tc.expectedRange) {
      rangePasses++;
      if (capture.captureMetadata?.captureSource === 'LLM') llmRangePasses++;
    }
    if (inBounds) {
      boundsPasses++;
      if (capture.captureMetadata?.captureSource === 'LLM') llmBoundsPasses++;
    }

    if (tc.expectedMarks !== undefined) {
      totalMarkError += absoluteMarkError(result.suggestedMarks, tc.expectedMarks);
      markErrorCount++;
      if (capture.captureMetadata?.captureSource === 'LLM') {
        llmTotalMarkError += absoluteMarkError(result.suggestedMarks, tc.expectedMarks);
        llmMarkErrorCount++;
      }
    }

    const status = (inRange && inBounds) ? 'PASS' : 'FAIL';
    const expectedStr = tc.expectedRange ? `${tc.expectedRange[0]}-${tc.expectedRange[1]}` : 'N/A';
    
    const criterionBreakdown = result.criteria?.map(c => `${c.status}: ${c.awardedMarks}/${c.maxMarks}`).join(' | ') || 'No criteria';
    
    perCaseReports.push(`[${status}] ${tc.id.padEnd(20)} expected ${expectedStr.padEnd(5)} | actual ${result.suggestedMarks} | Criteria Count: ${result.criteria?.length || 0} | ${criterionBreakdown}`);
    successful++;
  }

  return { 
    totalCases, successful, missingCaptures, validationFailures, 
    totalCaptures: totalCapturesCount, llmCaptures, bypassCaptures,
    rangePasses, boundsPasses, criteriaMathPasses, 
    totalMarkError, markErrorCount,
    llmRangePasses, llmBoundsPasses, llmCriteriaMathPasses,
    llmTotalMarkError, llmMarkErrorCount, perCaseReports 
  };
}

describe('Grading Replay Runner', () => {
  it('runs grading evaluation deterministically from captures', () => {
    console.log('Bootstrapping grading REPLAY baseline...');
    const { GRADING_EVAL_CASES } = require('./datasets/grading-cases');
    const fixture = require('./datasets/grading-replay.fixture');
    const captures = fixture.GRADING_CAPTURES || [];
    
    const result = runReplayEval(GRADING_EVAL_CASES, captures);

    console.log('\nREPLAY BASELINE (Phase 13.6 Static Capture Replay)');
    console.log('==================================================');
    console.log(`Cases: ${result.totalCases}`);
    console.log(`Successful replays: ${result.successful}`);
    console.log(`Total captures found: ${result.totalCaptures}`);
    console.log(`  - LLM captures: ${result.llmCaptures}`);
    console.log(`  - Deterministic bypass captures: ${result.bypassCaptures}`);
    console.log(`Missing captures: ${result.missingCaptures}`);
    console.log(`Validation failures: ${result.validationFailures}\n`);

    const datasetRangeAccuracy = Math.round((result.rangePasses / GRADING_EVAL_CASES.filter((c: any) => !!c.expectedRange).length) * 100);
    const successfulRangeAccuracy = result.successful ? Math.round((result.rangePasses / result.successful) * 100) : 0;
    const boundsAccuracy = result.successful ? Math.round((result.boundsPasses / result.successful) * 100) : 0;
    const mathAccuracy = result.successful ? Math.round((result.criteriaMathPasses / result.successful) * 100) : 0;
    const meanError = result.markErrorCount ? (result.totalMarkError / result.markErrorCount).toFixed(2) : 'N/A';

    console.log(`\n--- ALL AVAILABLE CAPTURES ---`);
    console.log(`Dataset range accuracy: ${result.rangePasses}/${result.totalCases} = ${datasetRangeAccuracy}%`);
    console.log(`Successful-evaluation range accuracy: ${result.rangePasses}/${result.successful} = ${successfulRangeAccuracy}%`);
    console.log(`Score bounds validity: ${boundsAccuracy}%`);
    console.log(`Rubric math validity: ${mathAccuracy}%`);
    console.log(`Mean absolute mark error: ${meanError} (n=${result.markErrorCount})`);

    const llmDatasetRangeAccuracy = Math.round((result.llmRangePasses / GRADING_EVAL_CASES.filter((c: any) => !!c.expectedRange).length) * 100);
    const llmSuccessfulRangeAccuracy = result.llmCaptures ? Math.round((result.llmRangePasses / result.llmCaptures) * 100) : 0;
    const llmBoundsAccuracy = result.llmCaptures ? Math.round((result.llmBoundsPasses / result.llmCaptures) * 100) : 0;
    const llmMathAccuracy = result.llmCaptures ? Math.round((result.llmCriteriaMathPasses / result.llmCaptures) * 100) : 0;
    const llmMeanError = result.llmMarkErrorCount ? (result.llmTotalMarkError / result.llmMarkErrorCount).toFixed(2) : 'N/A';

    console.log(`\n--- GENUINE LLM CAPTURES ONLY (${result.llmCaptures}) ---`);
    console.log(`Dataset range accuracy: ${result.llmRangePasses}/${result.totalCases} = ${llmDatasetRangeAccuracy}%`);
    console.log(`Successful-evaluation range accuracy: ${result.llmRangePasses}/${result.llmCaptures} = ${llmSuccessfulRangeAccuracy}%`);
    console.log(`Score bounds validity: ${llmBoundsAccuracy}%`);
    console.log(`Rubric math validity: ${llmMathAccuracy}%`);
    console.log(`Mean absolute mark error: ${llmMeanError} (n=${result.llmMarkErrorCount})\n`);

    console.log('Per-case:');
    result.perCaseReports.forEach((r: string) => console.log(r));

    console.log('\nIMPORTANT: These metrics reflect purely deterministic evaluation of statically captured responses. They do NOT reflect live AI provider latency, reliability, or retry exhaustion rates.\n');
  });
});
