import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { EvaluationLoopService } from '../../../src/ai/evaluators/answer-evaluation-loop.service';
import { AnswerEvaluationService } from '../../../src/ai/evaluators/answer-evaluation.service';
import { GRADING_EVAL_CASES } from './datasets/grading-cases';
import { marksWithinExpectedRange, scoreBoundsValid, absoluteMarkError } from './metrics/grading.metrics';
import { REGRESSION_THRESHOLDS, printEvaluationResult, EvalResult } from './regression/regression-thresholds';

describe('Grading Baseline Runner', () => {
  it('runs grading baseline on all cases', async () => {
    console.log('Bootstrapping grading baseline eval (Phase 11.6)...');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    
    const evaluator = app.get(EvaluationLoopService);
    const innerService = app.get(AnswerEvaluationService);

    const totalCases = GRADING_EVAL_CASES.length;
    let successful = 0;
    let failures = 0;
    let rangePasses = 0;
    let boundsPasses = 0;
    let totalMarkError = 0;
    let markErrorCount = 0;
    let totalLatency = 0;
    let maxLatency = 0;

    let totalAttempts = 0;

    console.log('\nRunning cases through EvaluationLoopService...\n');
    const perCaseReports: string[] = [];

    const spy = jest.spyOn(innerService, 'evaluate');

    for (const tc of GRADING_EVAL_CASES) {
      const start = Date.now();
      spy.mockClear();
      try {
        const result = await evaluator.evaluate(tc.question as any, tc.studentAnswer as any);
        const latency = Date.now() - start;
        totalLatency += latency;
        maxLatency = Math.max(maxLatency, latency);

        const attempts = spy.mock.calls.length;
        totalAttempts += attempts;

        const inRange = tc.expectedRange
          ? marksWithinExpectedRange(result.suggestedMarks, tc.expectedRange)
          : true;
        const inBounds = scoreBoundsValid(result.suggestedMarks, tc.question.marks);

        if (inRange && tc.expectedRange) rangePasses++;
        if (inBounds) boundsPasses++;

        if (tc.expectedMarks !== undefined) {
          totalMarkError += absoluteMarkError(result.suggestedMarks, tc.expectedMarks);
          markErrorCount++;
        }

        const status = (inRange && inBounds) ? 'PASS' : 'FAIL';
        const expectedStr = tc.expectedRange ? `${tc.expectedRange[0]}-${tc.expectedRange[1]}` : 'N/A';
        perCaseReports.push(`[${status}] ${tc.id.padEnd(20)} expected ${expectedStr.padEnd(5)} | actual ${result.suggestedMarks} (attempts: ${attempts})`);
        successful++;
      } catch (error: any) {
        const attempts = spy.mock.calls.length;
        totalAttempts += attempts;
        perCaseReports.push(`[ERROR] ${tc.id.padEnd(20)} failed: ${error.message} (attempts: ${attempts})`);
        failures++;
      }
    }

    console.log('\nAI GRADING BASELINE (Phase 11.6 Production-Loop)');
    console.log('==================================================');
    console.log(`Cases: ${totalCases}`);
    console.log(`Successful final evaluations: ${successful}`);
    console.log(`Exhausted/failed evaluations: ${failures}`);
    console.log(`Final evaluation success rate: ${Math.round((successful / totalCases) * 100)}%`);
    console.log(`Total LLM attempts across all cases: ${totalAttempts} (observable via jest.spyOn)\n`);

    const datasetRangeAccuracy = Math.round((rangePasses / GRADING_EVAL_CASES.filter(c => !!c.expectedRange).length) * 100);
    const successfulRangeCasesCount = GRADING_EVAL_CASES.filter(c => !!c.expectedRange).length - failures; // Assuming all failures had expectedRange. Safest is below.
    // wait, we only want to count rangePasses / successful cases that HAVE an expected range
    const successfulWithRange = GRADING_EVAL_CASES.filter(c => !!c.expectedRange).length; // actually we just need successful for denominator, but let's just do successful cases that had an expectedRange. Actually wait, to be perfectly precise, it's successful evaluated ones with expected ranges, but all grading cases have expected ranges here. Let's just use total successful since we know all 8 have ranges.
    
    const successfulRangeAccuracy = successful ? Math.round((rangePasses / successful) * 100) : 0;
    const boundsAccuracy = successful ? Math.round((boundsPasses / successful) * 100) : 0;
    const meanError = markErrorCount ? (totalMarkError / markErrorCount).toFixed(2) : 'N/A';
    const avgLatency = successful ? Math.round(totalLatency / successful) : 0;

    console.log(`Dataset range accuracy: ${rangePasses}/${totalCases} = ${datasetRangeAccuracy}%`);
    console.log(`Successful-evaluation range accuracy: ${rangePasses}/${successful} = ${successfulRangeAccuracy}%`);
    console.log(`Score bounds validity: ${boundsAccuracy}%`);
    console.log(`Mean absolute mark error: ${meanError} (n=${markErrorCount})\n`);

    console.log('--- REGRESSION POLICY ---');
    const isStrict = process.env.EVAL_STRICT === 'true';
    const t = REGRESSION_THRESHOLDS.GRADING;
    
    const results = [
      printEvaluationResult('Score Bounds Validity', boundsAccuracy, t.SCORE_BOUNDS_VALIDITY, isStrict),
      printEvaluationResult('Final Success Rate', Math.round((successful / totalCases) * 100), t.FINAL_SUCCESS_RATE, isStrict),
      printEvaluationResult('Successful Range Accuracy', successfulRangeAccuracy, t.SUCCESSFUL_ONLY_RANGE_ACCURACY, isStrict),
    ];
    console.log('-------------------------\n');
    
    console.log(`Average latency (successful cases): ${(avgLatency / 1000).toFixed(2)}s`);
    console.log(`Maximum latency: ${(maxLatency / 1000).toFixed(2)}s\n`);

    console.log('Per-case:');
    perCaseReports.forEach((r) => console.log(r));

    console.log('\nCOMPARISON (Phase 11.5 vs Phase 11.6)');
    console.log('Metric                         11.5 single-call   11.6 production-loop');
    console.log(`Successful evaluations        7/8                ${successful}/8`);
    console.log(`Dataset range accuracy         4/8                ${rangePasses}/8`);
    console.log(`Successful-only accuracy       4/7                ${rangePasses}/${successful}`);
    console.log(`Score bounds validity         100%               ${boundsAccuracy}%`);
    console.log(`Mean absolute mark error      0.00 (n=4)         ${meanError} (n=${markErrorCount})`);
    console.log(`Average case latency          10.77s             ${(avgLatency / 1000).toFixed(2)}s`);
    console.log(`Maximum case latency          40.98s             ${(maxLatency / 1000).toFixed(2)}s\n`);

    spy.mockRestore();
    await app.close();

    if (results.includes(EvalResult.REGRESSION)) {
      throw new Error(`Baseline run failed due to metric REGRESSION.`);
    }

    if (failures > 0 && isStrict) {
      throw new Error(`Baseline run failed with ${failures} exhausted errors (Strict mode).`);
    }
  }, 600000); // 600s timeout
});

