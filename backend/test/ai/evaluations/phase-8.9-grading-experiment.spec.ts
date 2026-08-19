import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { TypedEvaluatorService } from '../../../src/ai/evaluators/typed-evaluator.service';
import { Question, StudentAnswer, QuestionType } from '../../../src/generated/prisma/client';

describe('Phase 8.9 Grading Experiment (Development Only)', () => {
  let evaluator: TypedEvaluatorService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    evaluator = module.get<TypedEvaluatorService>(TypedEvaluatorService);
  });

  it('runs grading experiment on photosynthesis', async () => {
    const baseQuestion: Question = {
      id: 'q1',
      questionId: 'qid',
      assessmentId: 'a1',
      type: QuestionType.TYPED,
      prompt: 'Explain the process of photosynthesis and its importance to life on Earth.',
      marks: 5,
      order: 1,
      options: null,
      correctOption: null,
      explanation: null,
      modelAnswer: 'Photosynthesis is the process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water. It involves the green pigment chlorophyll and generates oxygen as a byproduct. It is important because it is the primary source of organic matter for all life and provides oxygen for respiration.',
      gradingInstructions: 'Give up to 2 marks for explaining the process (sunlight, CO2, water). Give 1 mark for mentioning chlorophyll or oxygen. Give up to 2 marks for explaining importance (food source, oxygen for breathing).',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const testCases = [
      {
        label: 'clearly correct',
        expectedRange: [4, 5],
        answer: 'Photosynthesis is how plants make food using sunlight, water, and CO2. They use chlorophyll to do this, and release oxygen. It is crucial because it gives animals food to eat and oxygen to breathe.',
      },
      {
        label: 'mostly correct / partial',
        expectedRange: [2, 4],
        answer: 'Plants make their own food using sunlight. This is called photosynthesis. It keeps plants alive so we can eat them.',
      },
      {
        label: 'weak or incomplete',
        expectedRange: [1, 2],
        answer: 'its when plants grow in the sun',
      },
      {
        label: 'clearly incorrect',
        expectedRange: [0, 1],
        answer: 'Photosynthesis is when animals digest food to get energy.',
      },
      {
        label: 'empty answer',
        expectedRange: [0, 0],
        answer: '   ',
      }
    ];

    let withinRangeCount = 0;

    for (const tc of testCases) {
      console.log(`\n=============================================`);
      console.log(`Test Case: ${tc.label}`);
      console.log(`Expected Range: ${tc.expectedRange[0]}-${tc.expectedRange[1]} / ${baseQuestion.marks}`);
      console.log(`Student Answer: "${tc.answer}"`);

      const studentAnswer: StudentAnswer = {
        id: 'a1',
        attemptId: 'att1',
        questionId: 'q1',
        selectedOption: null,
        textAnswer: tc.answer,
        voiceUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await evaluator.evaluate(baseQuestion, studentAnswer);
      console.log(`\n[Result]`);
      console.log(`Marks: ${result.suggestedMarks}`);
      console.log(`Feedback: ${result.feedback}`);
      console.log(`Reasoning: ${result.reasoning}`);
      console.log(`Confidence: ${result.confidence}`);

      const withinRange = result.suggestedMarks >= tc.expectedRange[0] && result.suggestedMarks <= tc.expectedRange[1];
      if (withinRange) withinRangeCount++;
    }

    console.log(`\n=============================================`);
    console.log(`Summary: ${withinRangeCount}/${testCases.length} fell within expected range.`);
  }, 60000); // 60 seconds timeout

  it('runs grading experiment on code', async () => {
    const codeQuestion: Question = {
      id: 'q2',
      questionId: 'qid2',
      assessmentId: 'a1',
      type: QuestionType.TYPED,
      prompt: 'Write a JavaScript function that takes an array of numbers and returns the sum.',
      marks: 3,
      order: 2,
      options: null,
      correctOption: null,
      explanation: null,
      modelAnswer: 'function sum(arr) { return arr.reduce((a, b) => a + b, 0); }',
      gradingInstructions: '1 mark for correct function signature. 2 marks for correct logic (using reduce or a loop). Deduct 1 mark if it does not handle empty arrays properly.',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const codeTestCases = [
      {
        label: 'clearly correct',
        expectedRange: [3, 3],
        answer: 'const sum = (arr) => arr.reduce((a, b) => a + b, 0);',
      },
      {
        label: 'mostly correct / partial',
        expectedRange: [2, 2],
        answer: 'function sum(arr) { let total = 0; for(let n of arr) { total += n; } return total; }', 
      },
      {
        label: 'weak or incomplete',
        expectedRange: [1, 2],
        answer: 'function sum(arr) { return arr[0] + arr[1]; }',
      }
    ];

    let codeWithinRangeCount = 0;
    for (const tc of codeTestCases) {
      console.log(`\n=============================================`);
      console.log(`[Code Q] Test Case: ${tc.label}`);
      console.log(`Expected Range: ${tc.expectedRange[0]}-${tc.expectedRange[1]} / ${codeQuestion.marks}`);
      console.log(`Student Answer: "${tc.answer}"`);

      const studentAnswer: StudentAnswer = {
        id: 'a2',
        attemptId: 'att1',
        questionId: 'q2',
        selectedOption: null,
        textAnswer: tc.answer,
        voiceUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await evaluator.evaluate(codeQuestion, studentAnswer);
      console.log(`\n[Result]`);
      console.log(`Marks: ${result.suggestedMarks}`);
      console.log(`Feedback: ${result.feedback}`);
      console.log(`Reasoning: ${result.reasoning}`);
      console.log(`Confidence: ${result.confidence}`);

      const withinRange = result.suggestedMarks >= tc.expectedRange[0] && result.suggestedMarks <= tc.expectedRange[1];
      if (withinRange) codeWithinRangeCount++;
    }

    console.log(`\n=============================================`);
    console.log(`Code Question Summary: ${codeWithinRangeCount}/${codeTestCases.length} fell within expected range.`);
  }, 60000);
});
