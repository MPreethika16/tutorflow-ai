import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { SemanticQuestionSearchService } from '../../../src/ai/semantic-question-search.service';

describe('Run Semantic Experiment', () => {
  it('should run semantic queries', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    const app = module.createNestApplication();
    await app.init();
    
    const searchService = app.get(SemanticQuestionSearchService);
    
    const queries = [
      "How do plants make their food using sunlight?", // Photosynthesis
      "Tell me about the Mughal Empire and ancient Indian history.", // Indian history
      "What is the formula to find the roots of a polynomial of degree two?", // Quadratic equations
    ];

    for (const q of queries) {
      console.log(`\n\n=== QUERY: "${q}" ===`);
      const results = await searchService.searchSimilarQuestions(q, 5);
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        console.log(`[Rank ${i+1}] Distance: ${r.distance.toFixed(4)}`);
        console.log(`  ID: ${r.id}`);
        console.log(`  Prompt: ${r.prompt}`);
        console.log(`  Type: ${r.type}, Marks: ${r.marks}`);
      }
    }
    
    await app.close();
  }, 60000);
});
