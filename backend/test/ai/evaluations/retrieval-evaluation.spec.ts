import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { SemanticQuestionSearchService } from '../../../src/ai/semantic-question-search.service';

const DATASET = [
  {
    query: "How do plants eat?",
    expectedPromptFragment: "photosynthesis",
    description: "semantically relevant"
  },
  {
    query: "What is F=ma?",
    expectedPromptFragment: "Newton",
    description: "semantically relevant"
  },
  {
    query: "What is New Delhi the capital of?",
    expectedPromptFragment: "capital of India",
    description: "semantically relevant"
  },
  {
    query: "Who discovered gravity?",
    expectedPromptFragment: "Newton",
    description: "semantically relevant"
  },
  {
    query: "Describe the process of converting light to chemical energy.",
    expectedPromptFragment: "photosynthesis",
    description: "semantically relevant"
  },
  {
    query: "Name a major city in South Asia.",
    expectedPromptFragment: "capital of India",
    description: "semantically relevant"
  },
  {
    query: "Solve the quadratic equation x^2 = 4",
    expectedPromptFragment: null,
    description: "no relevant question available in the corpus"
  }
];

describe('Retrieval Evaluation', () => {
  it('should evaluate recall', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    const app = module.createNestApplication();
    await app.init();
    
    const searchService = app.get(SemanticQuestionSearchService);
    
    let totalQueries = 0;
    let relevantQueries = 0;
    let hitsAt1 = 0;
    let hitsAt3 = 0;
    let hitsAt5 = 0;

    for (const item of DATASET) {
      totalQueries++;
      console.log(`\nEvaluating Query: "${item.query}" (${item.description})`);
      
      const results = await searchService.searchSimilarQuestions(item.query, 5);
      
      if (item.expectedPromptFragment === null) {
        console.log(`  Expected: None. (Evaluating handling of out-of-domain queries)`);
        // We consider this a true negative check, but recall doesn't strictly apply here.
        // We just print what it found at Rank 1.
        if (results.length > 0) {
          console.log(`  Highest match distance: ${results[0].distance.toFixed(4)} (${results[0].prompt})`);
        }
        continue;
      }
      
      relevantQueries++;
      
      const rank1 = results.slice(0, 1).some(r => r.prompt.includes(item.expectedPromptFragment!));
      const rank3 = results.slice(0, 3).some(r => r.prompt.includes(item.expectedPromptFragment!));
      const rank5 = results.slice(0, 5).some(r => r.prompt.includes(item.expectedPromptFragment!));
      
      if (rank1) hitsAt1++;
      if (rank3) hitsAt3++;
      if (rank5) hitsAt5++;
      
      console.log(`  Expected Fragment: "${item.expectedPromptFragment}"`);
      console.log(`  Found in Top 1: ${rank1 ? 'YES' : 'NO'}`);
      console.log(`  Found in Top 3: ${rank3 ? 'YES' : 'NO'}`);
      console.log(`  Found in Top 5: ${rank5 ? 'YES' : 'NO'}`);
      
      // Print the top 3 just for context
      results.slice(0, 3).forEach((r, idx) => {
        console.log(`    Rank ${idx+1} [Dist: ${r.distance.toFixed(4)}]: ${r.prompt}`);
      });
    }
    
    console.log(`\n========================================`);
    console.log(`EVALUATION RESULTS`);
    console.log(`========================================`);
    console.log(`Total Evaluated Queries: ${relevantQueries} (excluding out-of-domain)`);
    console.log(`Recall@1: ${((hitsAt1 / relevantQueries) * 100).toFixed(1)}% (${hitsAt1}/${relevantQueries})`);
    console.log(`Recall@3: ${((hitsAt3 / relevantQueries) * 100).toFixed(1)}% (${hitsAt3}/${relevantQueries})`);
    console.log(`Recall@5: ${((hitsAt5 / relevantQueries) * 100).toFixed(1)}% (${hitsAt5}/${relevantQueries})`);
    console.log(`========================================\n`);
    
    await app.close();
  }, 120000);
});
