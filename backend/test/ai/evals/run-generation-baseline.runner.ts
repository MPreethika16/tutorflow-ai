import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { GenerationWorkflowService } from '../../../src/ai/graph/generation-workflow.service';
import { GeneratedPaperPersistenceService } from '../../../src/ai/generated-paper-persistence.service';
import { TeacherStyleRetriever } from '../../../src/ai/retrieval/teacher-style-retriever.service';
import { PaperRepairService } from '../../../src/ai/repair/paper-repair.service';
import { GENERATION_EVAL_CASES } from './datasets/generation-cases';
import { isSchemaValid, totalMarksCorrectness, requiredTypedFieldsCompletion } from './metrics/generation.metrics';
import { REGRESSION_THRESHOLDS, printEvaluationResult, EvalResult } from './regression/regression-thresholds';

describe('Generation Baseline Runner', () => {
  it('runs generation baseline on all cases', async () => {
    console.log('Bootstrapping generation baseline eval (Phase 11.7)...');
    
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

    const totalCases = GENERATION_EVAL_CASES.length;
    let successful = 0;
    let failures = 0;
    let schemaValidCount = 0;
    let marksCorrectCount = 0;
    let typedValidCount = 0;
    let totalLatency = 0;
    let maxLatency = 0;

    let totalRepairs = 0;

    console.log('\nRunning cases through GenerationWorkflowService...\n');
    const perCaseReports: string[] = [];

    const repairSpy = jest.spyOn(repairService, 'repair');

    for (const tc of GENERATION_EVAL_CASES) {
      const start = Date.now();
      repairSpy.mockClear();
      capturedGeneratedPaper = null;
      try {
        await evaluator.run('eval-teacher-id', tc.request as any);
        const latency = Date.now() - start;
        totalLatency += latency;
        maxLatency = Math.max(maxLatency, latency);

        const repairs = repairSpy.mock.calls.length;
        totalRepairs += repairs;

        const paper = capturedGeneratedPaper;
        const schemaValid = isSchemaValid(paper);
        const marksValid = schemaValid && totalMarksCorrectness(paper, tc.expectedConstraints.totalMarks);
        const typedValid = schemaValid && requiredTypedFieldsCompletion(paper);

        if (schemaValid) schemaValidCount++;
        if (marksValid) marksCorrectCount++;
        if (typedValid) typedValidCount++;

        const status = 'PASS';
        perCaseReports.push(`[${status}] ${tc.id.padEnd(12)} ${tc.description}\n       schema=${schemaValid} marks=${marksValid} typedFields=${typedValid}\n       latency=${latency}ms repairs=${repairs}\n`);
        successful++;
      } catch (error: any) {
        const latency = Date.now() - start;
        const repairs = repairSpy.mock.calls.length;
        totalRepairs += repairs;
        perCaseReports.push(`[ERROR] ${tc.id.padEnd(12)} ${tc.description}\n        failed: ${error.message}\n        latency=${latency}ms repairs=${repairs}\n`);
        failures++;
      }
    }

    console.log('\nAI GENERATION BASELINE');
    console.log('======================');
    console.log(`Cases: ${totalCases}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failures: ${failures}\n`);

    const schemaRate = successful ? Math.round((schemaValidCount / successful) * 100) : 0;
    const marksRate = successful ? Math.round((marksCorrectCount / successful) * 100) : 0;
    const typedRate = successful ? Math.round((typedValidCount / successful) * 100) : 0;

    console.log(`Schema validity: ${schemaRate}%`);
    console.log(`Total marks correctness: ${marksRate}%`);
    console.log(`Typed field completion: ${typedRate}%\n`);

    console.log('--- REGRESSION POLICY ---');
    const isStrict = process.env.EVAL_STRICT === 'true';
    const t = REGRESSION_THRESHOLDS.GENERATION;
    
    const results = [
      printEvaluationResult('Schema Validity', schemaRate, t.SCHEMA_VALIDITY, isStrict),
      printEvaluationResult('Total Marks Correctness', marksRate, t.TOTAL_MARKS_CORRECTNESS, isStrict),
      printEvaluationResult('Typed Fields Completion', typedRate, t.TYPED_FIELDS_COMPLETION, isStrict),
      printEvaluationResult('Success Rate', Math.round((successful / totalCases) * 100), t.SUCCESS_RATE, isStrict),
    ];
    console.log('-------------------------\n');

    const avgLatency = successful ? Math.round(totalLatency / successful) : 0;
    console.log(`Average latency: ${avgLatency} ms`);
    console.log(`Maximum latency: ${maxLatency} ms\n`);

    console.log(`Total repairs: ${totalRepairs}`);
    const avgRepairs = successful ? (totalRepairs / successful).toFixed(2) : 0;
    console.log(`Average repairs per successful generation: ${avgRepairs}\n`);

    console.log('Per-case:');
    perCaseReports.forEach((r) => console.log(r));

    repairSpy.mockRestore();
    await app.close();

    if (results.includes(EvalResult.REGRESSION)) {
      throw new Error(`Baseline run failed due to metric REGRESSION.`);
    }

    if (failures > 0 && isStrict) {
      throw new Error(`Baseline run failed with ${failures} errors (Strict mode).`);
    }
  }, 1200000); // 1200s timeout (generations take longer than grading)
});
