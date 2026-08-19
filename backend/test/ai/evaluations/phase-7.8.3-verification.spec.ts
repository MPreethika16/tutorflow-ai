import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { TeacherStyleRetriever } from '../../../src/ai/retrieval/teacher-style-retriever.service';
import { SemanticQuestionSearchService } from '../../../src/ai/semantic-question-search.service';

const TEACHER_ID = '964bbc2a-a16a-49c3-84b0-fe254fa8a59d';

const SCENARIOS = [
  {
    name: "1. Relevant existing topic",
    topic: "How do plants convert sunlight into energy?",
    board: "CBSE", grade: "10", subject: "Science",
    expectedResult: true,
    expectedKeyword: "photosynthesis"
  },
  {
    name: "2. Relevant existing physics topic",
    topic: "What is the formula F=ma?",
    board: "CBSE", grade: "10", subject: "Science",
    expectedResult: true,
    expectedKeyword: "Newton"
  },
  {
    name: "3. New/unseen topic",
    topic: "Solve for x in x^2 - 4 = 0",
    board: "CBSE", grade: "10", subject: "Science",
    expectedResult: false,
    expectedKeyword: null
  },
  {
    name: "4. Wrong metadata boundary",
    topic: "How do plants convert sunlight into energy?",
    board: "CBSE", grade: "10", subject: "History", // Wrong subject
    expectedResult: false,
    expectedKeyword: null
  }
];

describe('Phase 7.8.3 Verification', () => {
  it('should verify all TeacherStyleRetriever hybrid cases', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    const app = module.createNestApplication();
    await app.init();
    
    const retriever = app.get(TeacherStyleRetriever);
    const semanticSearch = app.get(SemanticQuestionSearchService);
    
    console.log(`\n========================================`);
    console.log(`FINAL RAG VERIFICATION (THRESHOLD: 0.70)`);
    console.log(`========================================`);

    for (const s of SCENARIOS) {
      console.log(`\nSCENARIO: ${s.name}`);
      console.log(`Input Metadata: Teacher: ${TEACHER_ID.split('-')[0]} | ${s.subject} | ${s.board} | Grade ${s.grade}`);
      console.log(`Topic: "${s.topic}"`);
      
      // Get raw distances just for reporting
      const rawSemantic = await semanticSearch.searchSimilarQuestions(s.topic, 3);
      
      // Run the actual production hybrid retriever
      const results = await retriever.retrieve({
        teacherUserId: TEACHER_ID,
        board: s.board,
        grade: s.grade,
        subject: s.subject,
        topic: s.topic,
        topK: 5
      });
      
      if (results.length === 0) {
        console.log(`Returned Questions: NONE`);
      } else {
        results.forEach((r, i) => {
          // Find the distance by matching the prompt against rawSemantic
          const rawMatch = rawSemantic.find(rs => rs.prompt === r.prompt);
          const distStr = rawMatch ? `(Dist: ${rawMatch.distance.toFixed(4)})` : '';
          console.log(`  [Rank ${i+1}] ${r.prompt} ${distStr}`);
        });
      }
      
      // Check expectation
      let success = false;
      if (s.expectedResult) {
        const found = results.some(r => r.prompt.includes(s.expectedKeyword!));
        console.log(`Expected Result: YES (${s.expectedKeyword}) | Actual: ${found ? 'YES' : 'NO'}`);
        success = found;
      } else {
        const empty = results.length === 0;
        console.log(`Expected Result: EMPTY | Actual: ${empty ? 'EMPTY' : 'NOT EMPTY'}`);
        success = empty;
      }
      
      expect(success).toBe(true);
    }
    
    await app.close();
  }, 120000);
});
