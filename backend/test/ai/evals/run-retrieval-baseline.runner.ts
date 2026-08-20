import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { TeacherStyleRetriever } from '../../../src/ai/retrieval/teacher-style-retriever.service';
import { RETRIEVAL_EVAL_CASES } from './datasets/retrieval-cases';
import { recallAtK, rejectionAccuracy } from './metrics/retrieval.metrics';
import { seedRetrievalCorpus } from './helpers/seed-retrieval-corpus';
import { EVAL_TEACHER_ID } from './datasets/retrieval-corpus';
import { REGRESSION_THRESHOLDS, printEvaluationResult, EvalResult } from './regression/regression-thresholds';

describe('Retrieval Baseline Runner', () => {
  it('runs retrieval baseline on all cases', async () => {
    console.log('Bootstrapping retrieval baseline eval (Phase 11.8)...');
    
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    const app = module.createNestApplication();
    await app.init();
    
    await seedRetrievalCorpus(app);
    
    const retriever = app.get(TeacherStyleRetriever);

    const totalCases = RETRIEVAL_EVAL_CASES.length;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    
    let recall1Hits = 0;
    let recall3Hits = 0;
    let recall5Hits = 0;
    let rejectionHits = 0;

    let relevantQueryHits = 0; // successfully executed positive cases
    let outOfDomainRejections = 0; // successfully executed negative cases
    
    let totalLatency = 0;
    let maxLatency = 0;

    console.log('\nRunning cases through TeacherStyleRetriever...\n');
    const perCaseReports: string[] = [];

    for (const tc of RETRIEVAL_EVAL_CASES) {
      const start = Date.now();
      try {
        const results = await retriever.retrieve({
          teacherUserId: EVAL_TEACHER_ID,
          board: 'CBSE',
          grade: '10',
          subject: 'Science',
          topic: tc.query,
          topK: 5,
        });

        const latency = Date.now() - start;
        totalLatency += latency;
        maxLatency = Math.max(maxLatency, latency);

        const r1 = recallAtK(results, tc.expectedPromptFragment || '', 1);
        const r3 = recallAtK(results, tc.expectedPromptFragment || '', 3);
        const r5 = recallAtK(results, tc.expectedPromptFragment || '', 5);
        const rejected = tc.shouldReject ? results.length === 0 : false;
        
        const rejectionScore = tc.shouldReject ? rejectionAccuracy(results, true) : false;

        // Collect metrics
        if (tc.shouldReject) {
          outOfDomainRejections++;
          if (rejectionScore) rejectionHits++;
        } else {
          relevantQueryHits++;
          if (r1) recall1Hits++;
          if (r3) recall3Hits++;
          if (r5) recall5Hits++;
        }

        const metricsStr = tc.shouldReject 
          ? `rejected=${rejectionScore}`
          : `r@1=${r1} r@3=${r3} r@5=${r5}`;
        
        let limitationStr = '';
        if (!tc.shouldReject && results.length === 0) {
          limitationStr = ' (CORPUS LIMITATION: DB empty for this case)';
        }

        perCaseReports.push(`[PASS] ${tc.id.padEnd(12)} ${tc.query}\n       ${metricsStr}\n       latency=${latency}ms${limitationStr}\n`);
        successfulExecutions++;
      } catch (error: any) {
        const latency = Date.now() - start;
        perCaseReports.push(`[ERROR] ${tc.id.padEnd(12)} ${tc.query}\n        failed: ${error.message}\n        latency=${latency}ms\n`);
        failedExecutions++;
      }
    }

    console.log('\nAI RETRIEVAL BASELINE');
    console.log('=====================');
    console.log(`Cases: ${totalCases}`);
    console.log(`Successful Executions: ${successfulExecutions}`);
    console.log(`Failed Executions: ${failedExecutions}\n`);

    const r1Rate = relevantQueryHits ? Math.round((recall1Hits / relevantQueryHits) * 100) : 0;
    const r3Rate = relevantQueryHits ? Math.round((recall3Hits / relevantQueryHits) * 100) : 0;
    const r5Rate = relevantQueryHits ? Math.round((recall5Hits / relevantQueryHits) * 100) : 0;
    const rejRate = outOfDomainRejections ? Math.round((rejectionHits / outOfDomainRejections) * 100) : 0;

    console.log(`Recall@1: ${r1Rate}%`);
    console.log(`Recall@3: ${r3Rate}%`);
    console.log(`Recall@5: ${r5Rate}%`);
    console.log(`Rejection Accuracy: ${rejRate}%\n`);

    console.log('--- REGRESSION POLICY ---');
    const isStrict = process.env.EVAL_STRICT === 'true';
    const t = REGRESSION_THRESHOLDS.RETRIEVAL;
    
    const results = [
      printEvaluationResult('Recall@3', r3Rate, t.RECALL_AT_3, isStrict),
      printEvaluationResult('Rejection Accuracy', rejRate, t.REJECTION_ACCURACY, isStrict),
    ];
    console.log('-------------------------\n');

    const avgLatency = successfulExecutions ? Math.round(totalLatency / successfulExecutions) : 0;
    console.log(`Average latency: ${avgLatency} ms`);
    console.log(`Maximum latency: ${maxLatency} ms\n`);

    console.log(`Relevant-query hit count: ${relevantQueryHits}`);
    console.log(`Out-of-domain rejection count: ${outOfDomainRejections}\n`);

    console.log('Per-case:');
    perCaseReports.forEach((r) => console.log(r));

    await app.close();

    if (results.includes(EvalResult.REGRESSION)) {
      throw new Error(`Baseline run failed due to metric REGRESSION.`);
    }

    if (failedExecutions > 0 && isStrict) {
      throw new Error(`Baseline run failed with ${failedExecutions} errors (Strict mode).`);
    }
  }, 120000);
});
