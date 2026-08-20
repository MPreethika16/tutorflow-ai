import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { GenerationWorkflowService } from '../../../src/ai/graph/generation-workflow.service';
import { GeneratedPaperPersistenceService } from '../../../src/ai/generated-paper-persistence.service';
import { TeacherStyleRetriever } from '../../../src/ai/retrieval/teacher-style-retriever.service';
import { PaperRepairService } from '../../../src/ai/repair/paper-repair.service';
import { AiService } from '../../../src/ai/ai.service';
import { GENERATION_EVAL_CASES } from './datasets/generation-cases';
import { isSchemaValid, totalMarksCorrectness, requiredTypedFieldsCompletion } from './metrics/generation.metrics';
import { REGRESSION_THRESHOLDS, printEvaluationResult, EvalResult } from './regression/regression-thresholds';
import {
  classifyLatency,
  GENERATION_LATENCY_THRESHOLDS_MS,
  type LatencyClassification,
} from '../../../src/ai/graph/generation-observability.helper';

// ----------------------------------------------------------------
// Phase 12.5 per-case record
// ----------------------------------------------------------------
interface CaseRecord {
  id: string;
  description: string;
  success: boolean;
  providerAttempts: number;
  repairs: number;
  elapsedMs: number;
  latencyClassification: LatencyClassification;
  errorMessage?: string;
  errorCode?: string;
}

describe('Generation Baseline Runner', () => {
  it('runs generation baseline on all cases', async () => {
    console.log('Bootstrapping generation baseline eval (Phase 12.5 — with observability)...');

    // We mock persistence to avoid DB side effects while evaluating the real LangGraph.
    let capturedGeneratedPaper: any = null;
    const mockPersistenceService = {
      saveDraft: jest.fn().mockImplementation(async (teacherId, request, paper) => {
        capturedGeneratedPaper = paper;
        return {
          assessmentId: 'mock-id',
          kind: request.kind,
          source: 'AI_EVAL',
          status: 'DRAFT',
          title: 'Eval Assessment',
          maximumMarks: request.totalMarks,
          durationMinutes: request.durationMinutes,
        };
      })
    };

    const mockTeacherStyleRetriever = {
      retrieve: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(GeneratedPaperPersistenceService)
    .useValue(mockPersistenceService)
    .overrideProvider(TeacherStyleRetriever)
    .useValue(mockTeacherStyleRetriever)
    .compile();

    const app = module.createNestApplication();
    await app.init();

    const evaluator = app.get(GenerationWorkflowService);
    const repairService = app.get(PaperRepairService);
    const aiService = app.get(AiService);

    const totalCases = GENERATION_EVAL_CASES.length;
    let successful = 0;
    let failures = 0;
    let schemaValidCount = 0;
    let marksCorrectCount = 0;
    let typedValidCount = 0;
    const allLatencies: number[] = [];
    let maxLatency = 0;

    let totalRepairs = 0;
    let casesRequiringRepair = 0;

    // Provider-level retry tracking
    let totalProviderCalls = 0;
    let casesRequiringRetry = 0;
    let retryExhaustionCount = 0; // cases that failed after using all 3 attempts
    let maxProviderCallsPerCase = 0;

    // Latency distribution
    let normalCount = 0;   // < 60s
    let warningCount = 0;  // >= 60s and < 180s
    let severeCount = 0;   // >= 180s

    // Error code frequency map
    const errorCodeFrequency: Record<string, number> = {};

    // Phase 12.5 per-case structured records
    const caseRecords: CaseRecord[] = [];

    console.log('\nRunning cases through GenerationWorkflowService...\n');

    const repairSpy = jest.spyOn(repairService, 'repair');
    const aiGenerateSpy = jest.spyOn(aiService, 'generateStructured');

    for (const tc of GENERATION_EVAL_CASES) {
      const start = Date.now();
      repairSpy.mockClear();
      aiGenerateSpy.mockClear();
      capturedGeneratedPaper = null;

      try {
        await evaluator.run('eval-teacher-id', tc.request as any);
        const elapsedMs = Date.now() - start;
        allLatencies.push(elapsedMs);
        maxLatency = Math.max(maxLatency, elapsedMs);

        const repairs = repairSpy.mock.calls.length;
        totalRepairs += repairs;
        if (repairs > 0) casesRequiringRepair++;

        // Provider attempts = total AI calls - repair calls
        const aiCalls = aiGenerateSpy.mock.calls.length;
        const providerAttemptsForCase = aiCalls - repairs;
        totalProviderCalls += providerAttemptsForCase;
        maxProviderCallsPerCase = Math.max(maxProviderCallsPerCase, providerAttemptsForCase);
        if (providerAttemptsForCase > 1) casesRequiringRetry++;

        const latencyClass = classifyLatency(elapsedMs);
        if (latencyClass === 'NORMAL') normalCount++;
        else if (latencyClass === 'WARNING') warningCount++;
        else severeCount++;

        const paper = capturedGeneratedPaper;
        const schemaValid = isSchemaValid(paper);
        const marksValid = schemaValid && totalMarksCorrectness(paper, tc.expectedConstraints.totalMarks);
        const typedValid = schemaValid && requiredTypedFieldsCompletion(paper);

        if (schemaValid) schemaValidCount++;
        if (marksValid) marksCorrectCount++;
        if (typedValid) typedValidCount++;

        caseRecords.push({
          id: tc.id,
          description: tc.description,
          success: true,
          providerAttempts: providerAttemptsForCase,
          repairs,
          elapsedMs,
          latencyClassification: latencyClass,
        });
        successful++;
      } catch (error: any) {
        const elapsedMs = Date.now() - start;
        allLatencies.push(elapsedMs);
        maxLatency = Math.max(maxLatency, elapsedMs);

        const repairs = repairSpy.mock.calls.length;
        const aiCalls = aiGenerateSpy.mock.calls.length;
        const providerAttemptsForCase = Math.max(1, aiCalls - repairs);
        totalProviderCalls += providerAttemptsForCase;
        maxProviderCallsPerCase = Math.max(maxProviderCallsPerCase, providerAttemptsForCase);
        if (providerAttemptsForCase > 1) casesRequiringRetry++;
        if (providerAttemptsForCase >= 3) retryExhaustionCount++;
        totalRepairs += repairs;
        if (repairs > 0) casesRequiringRepair++;

        // Extract AiProviderError code if available
        const errorCode: string | undefined = (error as any)?.code;
        if (errorCode) {
          errorCodeFrequency[errorCode] = (errorCodeFrequency[errorCode] ?? 0) + 1;
        }

        const latencyClass = classifyLatency(elapsedMs);
        if (latencyClass === 'NORMAL') normalCount++;
        else if (latencyClass === 'WARNING') warningCount++;
        else severeCount++;

        caseRecords.push({
          id: tc.id,
          description: tc.description,
          success: false,
          providerAttempts: providerAttemptsForCase,
          repairs,
          elapsedMs,
          latencyClassification: latencyClass,
          errorMessage: error.message,
          errorCode,
        });
        failures++;
      }
    }

    // Compute median latency
    const sortedLatencies = [...allLatencies].sort((a, b) => a - b);
    const medianLatency = sortedLatencies.length > 0
      ? sortedLatencies[Math.floor(sortedLatencies.length / 2)]
      : 0;
    const avgLatency = allLatencies.length > 0
      ? Math.round(allLatencies.reduce((s, v) => s + v, 0) / allLatencies.length)
      : 0;

    // ----------------------------------------------------------------
    // REPORT
    // ----------------------------------------------------------------

    console.log('\nAI GENERATION BASELINE (Phase 12.5)');
    console.log('====================================');
    console.log(`Cases:      ${totalCases}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failures:   ${failures}`);
    console.log(`Success rate: ${Math.round((successful / totalCases) * 100)}%\n`);

    const schemaRate = successful ? Math.round((schemaValidCount / successful) * 100) : 0;
    const marksRate  = successful ? Math.round((marksCorrectCount  / successful) * 100) : 0;
    const typedRate  = successful ? Math.round((typedValidCount    / successful) * 100) : 0;

    console.log(`Schema validity (on success):    ${schemaRate}%`);
    console.log(`Total marks correctness:         ${marksRate}%`);
    console.log(`Typed field completion:          ${typedRate}%\n`);

    console.log('--- REGRESSION POLICY ---');
    const isStrict = process.env.EVAL_STRICT === 'true';
    const t = REGRESSION_THRESHOLDS.GENERATION;
    const results = [
      printEvaluationResult('Schema Validity',        schemaRate,                                      t.SCHEMA_VALIDITY,        isStrict),
      printEvaluationResult('Total Marks Correctness', marksRate,                                      t.TOTAL_MARKS_CORRECTNESS, isStrict),
      printEvaluationResult('Typed Fields Completion', typedRate,                                      t.TYPED_FIELDS_COMPLETION, isStrict),
      printEvaluationResult('Success Rate',            Math.round((successful / totalCases) * 100),   t.SUCCESS_RATE,           isStrict),
    ];
    console.log('-------------------------\n');

    console.log('--- LATENCY ---');
    console.log(`Average latency:  ${avgLatency} ms  (${(avgLatency / 1000).toFixed(1)}s)`);
    console.log(`Median latency:   ${medianLatency} ms  (${(medianLatency / 1000).toFixed(1)}s)`);
    console.log(`Maximum latency:  ${maxLatency} ms  (${(maxLatency / 1000).toFixed(1)}s)`);
    console.log(`NORMAL  (<${GENERATION_LATENCY_THRESHOLDS_MS.WARNING / 1000}s):   ${normalCount}/${totalCases}`);
    console.log(`WARNING (>=${GENERATION_LATENCY_THRESHOLDS_MS.WARNING / 1000}s): ${warningCount}/${totalCases}`);
    console.log(`SEVERE  (>=${GENERATION_LATENCY_THRESHOLDS_MS.SEVERE  / 1000}s): ${severeCount}/${totalCases}\n`);

    console.log('--- PROVIDER BEHAVIOR ---');
    console.log(`Total provider attempts (excl. repairs): ${totalProviderCalls}`);
    console.log(`Cases requiring retry (>1 attempt):      ${casesRequiringRetry}/${totalCases}`);
    console.log(`Max attempts for one case:               ${maxProviderCallsPerCase}`);
    console.log(`Retry exhaustion (all 3 failed):         ${retryExhaustionCount}`);
    const errorCodeSummary = Object.keys(errorCodeFrequency).length > 0
      ? Object.entries(errorCodeFrequency).map(([k, v]) => `${k}×${v}`).join(', ')
      : 'none observed on failures';
    console.log(`Error codes on final failure:            ${errorCodeSummary}\n`);

    console.log('--- DOMAIN REPAIR ---');
    console.log(`Total repairs:                           ${totalRepairs}`);
    console.log(`Cases requiring repair:                  ${casesRequiringRepair}/${totalCases}`);
    const avgRepairs = successful ? (totalRepairs / successful).toFixed(2) : '0.00';
    console.log(`Avg repairs per successful case:         ${avgRepairs}\n`);

    console.log('--- PHASE 12.3 vs PHASE 12.5 COMPARISON ---');
    const successRate = Math.round((successful / totalCases) * 100);
    console.log(`Metric                            Phase 12.3     Phase 12.5`);
    console.log(`----------------------------------------------------------`);
    console.log(`Successful generations            8/8            ${successful}/8`);
    console.log(`Generation success rate           100%           ${successRate}%`);
    console.log(`Schema validity                   100%           ${schemaRate}%`);
    console.log(`Total marks correctness           100%           ${marksRate}%`);
    console.log(`Typed fields completion           100%           ${typedRate}%`);
    console.log(`Cases requiring retry             2/8            ${casesRequiringRetry}/8`);
    console.log(`Total provider attempts           12             ${totalProviderCalls}`);
    console.log(`Max provider attempts (one case)  3              ${maxProviderCallsPerCase}`);
    console.log(`Domain repairs                    0              ${totalRepairs}`);
    console.log(`Average latency                   91.2s          ${(avgLatency / 1000).toFixed(1)}s`);
    console.log(`Maximum latency                   302.0s         ${(maxLatency / 1000).toFixed(1)}s`);
    console.log(`SEVERE latency cases              2              ${severeCount}`);
    console.log('----------------------------------------------------------\n');

    console.log('--- PER-CASE RESULTS ---');
    for (const r of caseRecords) {
      const icon = r.success ? '[PASS]' : '[FAIL]';
      const extra = r.success ? '' : `  errorCode=${r.errorCode ?? 'unknown'} errorMsg="${r.errorMessage}"`;
      console.log(
        `${icon} ${r.id.padEnd(8)} ${r.description}\n` +
        `       attempts=${r.providerAttempts} repairs=${r.repairs} ` +
        `elapsedMs=${r.elapsedMs} latency=${r.latencyClassification}${extra}\n`
      );
    }

    repairSpy.mockRestore();
    aiGenerateSpy.mockRestore();
    await app.close();

    if (results.includes(EvalResult.REGRESSION)) {
      throw new Error(`Baseline run failed due to metric REGRESSION.`);
    }
    if (failures > 0 && isStrict) {
      throw new Error(`Baseline run failed with ${failures} errors (Strict mode).`);
    }
  }, 2400000);
});
