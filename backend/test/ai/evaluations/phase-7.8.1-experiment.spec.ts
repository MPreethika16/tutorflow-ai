import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { SemanticQuestionSearchService } from '../../../src/ai/semantic-question-search.service';

const QUERIES = [
  // Relevant Cases
  { topic: "How do plants make their food using sunlight?", expected: "photosynthesis" },
  { topic: "What is F=ma?", expected: "Newton" },
  { topic: "Who discovered gravity?", expected: "Newton" },
  { topic: "What is New Delhi the capital of?", expected: "capital of India" },
  { topic: "Name a major city in South Asia.", expected: "capital of India" },
  { topic: "Describe the process of converting light to chemical energy.", expected: "photosynthesis" },
  
  // Irrelevant Cases (Out of domain)
  { topic: "Solve the quadratic equation x^2 = 4", expected: null },
  { topic: "Who wrote Hamlet?", expected: null },
  { topic: "What is the capital of France?", expected: null },
  { topic: "Explain the theory of relativity.", expected: null },
  { topic: "How to bake a chocolate cake?", expected: null },
];

describe('Phase 7.8.1 Distance Distribution Experiment', () => {
  it('should calculate distance distributions', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    const app = module.createNestApplication();
    await app.init();
    
    const searchService = app.get(SemanticQuestionSearchService);
    
    const relevantDistances: number[] = [];
    const irrelevantDistances: number[] = [];

    for (const q of QUERIES) {
      const results = await searchService.searchSimilarQuestions(q.topic, 3);
      if (results.length === 0) continue;

      const top1 = results[0];
      const isRelevant = q.expected && top1.prompt.includes(q.expected);

      if (q.expected) {
        if (isRelevant) {
          relevantDistances.push(top1.distance);
          console.log(`[RELEVANT MATCH] "${q.topic}" -> Dist: ${top1.distance.toFixed(4)} (Found: ${top1.prompt})`);
        } else {
          // If expected, but top-1 is wrong, technically it's a false negative / false match
          console.log(`[FAILED MATCH] "${q.topic}" -> Dist: ${top1.distance.toFixed(4)} (Found: ${top1.prompt})`);
        }
      } else {
        // It's an irrelevant query, any result is technically irrelevant
        irrelevantDistances.push(top1.distance);
        console.log(`[IRRELEVANT MATCH] "${q.topic}" -> Dist: ${top1.distance.toFixed(4)} (Returned: ${top1.prompt})`);
      }
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const min = (arr: number[]) => Math.min(...arr);
    const max = (arr: number[]) => Math.max(...arr);

    console.log(`\n========================================`);
    console.log(`RELEVANT MATCHES (${relevantDistances.length})`);
    console.log(`Min: ${min(relevantDistances).toFixed(4)} | Max: ${max(relevantDistances).toFixed(4)} | Avg: ${avg(relevantDistances).toFixed(4)}`);
    console.log(`\nIRRELEVANT MATCHES (${irrelevantDistances.length})`);
    console.log(`Min: ${min(irrelevantDistances).toFixed(4)} | Max: ${max(irrelevantDistances).toFixed(4)} | Avg: ${avg(irrelevantDistances).toFixed(4)}`);
    console.log(`========================================`);
    
    await app.close();
  }, 120000);
});
