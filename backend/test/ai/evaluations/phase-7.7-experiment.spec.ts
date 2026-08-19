import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { TeacherStyleRetriever } from '../../../src/ai/retrieval/teacher-style-retriever.service';
import { SemanticQuestionSearchService } from '../../../src/ai/semantic-question-search.service';

const TEACHER_ID = '964bbc2a-a16a-49c3-84b0-fe254fa8a59d';

const QUERIES = [
  {
    name: "Clearly relevant Question",
    topic: "How do plants make their food using sunlight?",
    board: "CBSE", grade: "10", subject: "Science", teacherUserId: TEACHER_ID,
    expectedPrompt: "photosynthesis"
  },
  {
    name: "No relevant Question exists",
    topic: "Solve the quadratic equation x^2 = 4",
    board: "CBSE", grade: "10", subject: "Science", teacherUserId: TEACHER_ID,
    expectedPrompt: null
  },
  {
    name: "Semantic returns Question outside boundary",
    topic: "Explain Newton's second law.",
    // Pass wrong subject! So hybrid should return empty, semantic should return the physics question
    board: "CBSE", grade: "10", subject: "History", teacherUserId: TEACHER_ID,
    expectedPrompt: "Newton"
  }
];

describe('Phase 7.7 Retrieval Comparison Experiment', () => {
  it('should compare the 3 strategies', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    const app = module.createNestApplication();
    await app.init();
    
    const retriever = app.get(TeacherStyleRetriever);
    const semanticService = app.get(SemanticQuestionSearchService);
    
    for (const q of QUERIES) {
      console.log(`\n========================================`);
      console.log(`SCENARIO: ${q.name}`);
      console.log(`Topic: "${q.topic}"`);
      console.log(`Filters: Teacher ${q.teacherUserId.split('-')[0]} | ${q.subject} | ${q.board} | Grade ${q.grade}`);
      console.log(`Expected finding: ${q.expectedPrompt || 'NONE'}`);
      console.log(`========================================`);

      // 1. Metadata-Only (call retrieve without topic)
      const metaResults = await retriever.retrieve({
        teacherUserId: q.teacherUserId, board: q.board, grade: q.grade, subject: q.subject, topK: 5
      });
      console.log(`\n--- 1. METADATA-ONLY ---`);
      if (metaResults.length === 0) console.log(`  No results.`);
      metaResults.forEach((r, i) => console.log(`  [Rank ${i+1}] ${r.prompt}`));

      // 2. Semantic-Only (call SemanticQuestionSearchService)
      const semanticResults = await semanticService.searchSimilarQuestions(q.topic, 5);
      console.log(`\n--- 2. SEMANTIC-ONLY ---`);
      if (semanticResults.length === 0) console.log(`  No results.`);
      semanticResults.forEach((r, i) => console.log(`  [Rank ${i+1}] Dist: ${r.distance.toFixed(4)} | ${r.prompt}`));

      // 3. Hybrid (call retrieve with topic)
      const hybridResults = await retriever.retrieve({
        teacherUserId: q.teacherUserId, board: q.board, grade: q.grade, subject: q.subject, topic: q.topic, topK: 5
      });
      console.log(`\n--- 3. HYBRID ---`);
      if (hybridResults.length === 0) console.log(`  No results.`);
      hybridResults.forEach((r, i) => console.log(`  [Rank ${i+1}] ${r.prompt}`));

      // Calculate if expected prompt is found
      if (q.expectedPrompt) {
        const check = (results) => results.some(r => r.prompt.includes(q.expectedPrompt!));
        console.log(`\n--- RECALL METRICS ---`);
        console.log(`Metadata-Only Recall: ${check(metaResults) ? 'YES' : 'NO'} (found in Top-3)`);
        console.log(`Semantic-Only Recall: ${check(semanticResults) ? 'YES' : 'NO'} (found in Top-1)`);
        console.log(`Hybrid Recall:        ${check(hybridResults) ? 'YES' : 'NO'} (found in Top-1 if YES)`);
      }
    }
    
    await app.close();
  }, 120000);
});
