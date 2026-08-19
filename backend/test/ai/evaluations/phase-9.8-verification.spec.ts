import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AnswerEvaluationWorkerService } from '../../../src/ai/evaluators/answer-evaluation-worker.service';
import { StudentAssessmentsService } from '../../../src/student-assessments/student-assessments.service';
import { EvaluationStatus, QuestionType, AssessmentStatus, AnswerEvaluation } from '../../../src/generated/prisma/client';
import { AnswerEvaluationPersistenceService } from '../../../src/ai/evaluators/answer-evaluation-persistence.service';

describe('Phase 9.8 E2E Evaluation Pipeline (Development Only)', () => {
  let prisma: PrismaService;
  let workerService: AnswerEvaluationWorkerService;
  let studentAssessmentsService: StudentAssessmentsService;
  let persistenceService: AnswerEvaluationPersistenceService;

  let testStudentId: string;
  let testAssessmentId: string;
  let testAttemptId: string;
  let mcqQuestionId1: string;
  let mcqQuestionId2: string;
  let typedQuestionId: string;
  
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    workerService = module.get<AnswerEvaluationWorkerService>(AnswerEvaluationWorkerService);
    studentAssessmentsService = module.get<StudentAssessmentsService>(StudentAssessmentsService);
    persistenceService = module.get<AnswerEvaluationPersistenceService>(AnswerEvaluationPersistenceService);

    // Setup Test Data
    const user = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Teacher',
        email: 'teacher' + Date.now() + '@example.com',
        passwordHash: 'hash',
        role: 'TEACHER',
      }
    });

    const teacher = await prisma.teacher.create({
      data: {
        userId: user.id,
      }
    });

    const studentUser = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Student',
        passwordHash: 'hash',
        role: 'STUDENT',
      }
    });

    const student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        teacherId: teacher.userId,
        studentId: 'STU-' + Date.now(),
        board: 'CBSE',
        grade: '10',
      },
    });
    testStudentId = student.userId;

    const assessment = await prisma.assessment.create({
      data: {
        teacherId: teacher.userId,
        assessmentId: 'TEST-ASM-' + Date.now(),
        title: 'Phase 9.8 Test Assessment',
        description: 'E2E Testing',
        subject: 'SCIENCE',
        board: 'CBSE',
        grade: '10',
        status: 'PUBLISHED',
        startAt: new Date(Date.now() - 100000),
        endAt: new Date(Date.now() + 100000),
        maximumMarks: 7,
      },
    });
    testAssessmentId = assessment.id;
    const extAssessmentId = assessment.assessmentId;

    const mcq1 = await prisma.question.create({
      data: {
        assessmentId: testAssessmentId,
        questionId: 'ext-mcq1',
        type: QuestionType.MCQ,
        prompt: 'What is 2 + 2?',
        marks: 1,
        order: 1,
        options: [
          { id: '3', text: '3' },
          { id: '4', text: '4' },
          { id: '5', text: '5' }
        ],
        correctOption: '4',
      },
    });
    mcqQuestionId1 = mcq1.questionId;

    const mcq2 = await prisma.question.create({
      data: {
        assessmentId: testAssessmentId,
        questionId: 'ext-mcq2',
        type: QuestionType.MCQ,
        prompt: 'What is the capital of France?',
        marks: 1,
        order: 2,
        options: [
          { id: 'London', text: 'London' },
          { id: 'Paris', text: 'Paris' },
          { id: 'Berlin', text: 'Berlin' }
        ],
        correctOption: 'Paris',
      },
    });
    mcqQuestionId2 = mcq2.questionId;

    const typed = await prisma.question.create({
      data: {
        assessmentId: testAssessmentId,
        questionId: 'ext-typed',
        type: QuestionType.TYPED,
        prompt: 'Explain what photosynthesis is.',
        marks: 5,
        order: 3,
        modelAnswer: 'Process by which plants make food using sunlight.',
        gradingInstructions: 'Give marks for mentioning sunlight and plants.',
      },
    });
    typedQuestionId = typed.questionId;

    const attempt = await studentAssessmentsService.startAssessmentForStudent(testStudentId, extAssessmentId);
    testAttemptId = attempt.id;

    // Answer questions
    await studentAssessmentsService.saveAnswerForStudent(testStudentId, testAttemptId, mcqQuestionId1, { selectedOption: '4', textAnswer: undefined }); // Correct
    await studentAssessmentsService.saveAnswerForStudent(testStudentId, testAttemptId, mcqQuestionId2, { selectedOption: 'London', textAnswer: undefined }); // Incorrect
    await studentAssessmentsService.saveAnswerForStudent(testStudentId, testAttemptId, typedQuestionId, { selectedOption: undefined, textAnswer: 'Plants use the sun to make food.' }); // Typed
  });

  afterAll(async () => {
    // Cleanup
    await prisma.answerEvaluation.deleteMany({
      where: { studentAnswer: { attemptId: testAttemptId } }
    });
    await prisma.studentAnswer.deleteMany({ where: { attemptId: testAttemptId } });
    await prisma.assessmentAttempt.deleteMany({ where: { id: testAttemptId } });
    await prisma.question.deleteMany({ where: { assessmentId: testAssessmentId } });
    await prisma.assessment.deleteMany({});
    await prisma.student.deleteMany({ where: { userId: testStudentId } });
    await prisma.teacher.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('1. Submission queues AnswerEvaluations without blocking', async () => {
    const startTime = Date.now();
    await studentAssessmentsService.submitAttemptForStudent(testStudentId, testAttemptId);
    const duration = Date.now() - startTime;
    
    // Should be extremely fast (no LLM calls)
    expect(duration).toBeLessThan(1000);

    const evals = await prisma.answerEvaluation.findMany({
      where: { studentAnswer: { attemptId: testAttemptId } },
    });

    expect(evals.length).toBe(3);
    for (const ev of evals) {
      expect(ev.status).toBe(EvaluationStatus.PENDING);
    }
  });

  it('2. Worker claims PENDING rows and processes them correctly', async () => {
    // We will spy on evaluateAndPersist to simulate one failure
    const originalEvaluateAndPersist = persistenceService.evaluateAndPersist.bind(persistenceService);
    let failureInjected = false;

    jest.spyOn(persistenceService, 'evaluateAndPersist').mockImplementation(async (q, ans) => {
      if (q.id === mcqQuestionId2 && !failureInjected) {
        // Simulate a failure for the second MCQ
        failureInjected = true;
        throw new Error('Simulated evaluation failure');
      }
      return originalEvaluateAndPersist(q, ans);
    });

    // Mock logger to capture output
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const startTime = Date.now();
    // Claim and process
    // We are calling pollPendingEvaluations which claims up to 5 and processes them.
    // It should claim all 3, process them. mcq1 will succeed, mcq2 will fail, typed will succeed.
    await workerService.pollPendingEvaluations();
    const duration = Date.now() - startTime;
    
    // Check results
    const evals = await prisma.answerEvaluation.findMany({
      where: { studentAnswer: { attemptId: testAttemptId } },
      include: { studentAnswer: true },
    });

    for (const ev of evals) {
      if (ev.studentAnswer.questionId === mcqQuestionId1) {
        expect(ev.status).toBe(EvaluationStatus.WAITING_FOR_REVIEW);
        expect(ev.aiMarks).toBe(1);
        expect(ev.aiConfidence).toBe(1);
      } else if (ev.studentAnswer.questionId === mcqQuestionId2) {
        // We injected a failure
        expect(ev.status).toBe(EvaluationStatus.FAILED);
      } else if (ev.studentAnswer.questionId === typedQuestionId) {
        expect(ev.status).toBe(EvaluationStatus.WAITING_FOR_REVIEW);
        expect(ev.aiMarks).toBeGreaterThanOrEqual(0);
        expect(ev.aiConfidence).toBeGreaterThanOrEqual(0);
        console.log(`\nTYPED AI Marks: ${ev.aiMarks}, Confidence: ${ev.aiConfidence}`);
        console.log(`TYPED AI Feedback: ${ev.aiFeedback}`);
      }
    }

    console.log(`Processing duration: ${duration}ms`);
    consoleSpy.mockRestore();
  }, 60000); // 60s timeout since it calls the real AI

  it('3. Idempotency: WAITING_FOR_REVIEW / FAILED rows are not claimed again', async () => {
    // Set up a mock for queryRaw to ensure it doesn't try to query anything if we just rely on the DB
    // We will just run the claim method directly and expect it to return 0.
    const claimed = await workerService.claimPendingEvaluations(5);
    // Since our test attempt has 2 WAITING_FOR_REVIEW and 1 FAILED, none should be claimed.
    // (Assuming no other PENDING rows in the dev DB).
    // Let's ensure at least our attempt's rows are not claimed.
    const ourClaimed = claimed.filter(c => evalsInclude(c.studentAnswerId));
    expect(ourClaimed.length).toBe(0);

    function evalsInclude(studentAnswerId: string) {
      // Just to strictly check it didn't claim our test items
      return true; // if they were claimed, they would fail the 0 length check
    }
  });

  it('4. Teacher fields are protected', async () => {
    // Let's manually set teacher marks on the failed evaluation, then somehow process it again?
    // The instructions say "verify worker/evaluation persistence never overwrites: teacherMarks, teacherFeedback".
    // We can simulate a scenario where teacher fields exist before evaluation.
    
    // Set teacher fields on the FAILED evaluation
    const failedEval = await prisma.answerEvaluation.findFirstOrThrow({
      where: { studentAnswer: { question: { questionId: mcqQuestionId2 }, attemptId: testAttemptId } }
    });

    await prisma.answerEvaluation.update({
      where: { id: failedEval.id },
      data: {
        teacherMarks: 5,
        teacherFeedback: 'Teacher knows best',
        status: EvaluationStatus.PENDING, // reset to PENDING so worker can pick it up
      }
    });

    // We will let the real evaluation run this time (since we clear mocks)
    jest.restoreAllMocks();

    await workerService.pollPendingEvaluations(); // Will claim and process it

    const updatedEval = await prisma.answerEvaluation.findUnique({
      where: { id: failedEval.id }
    });

    expect(updatedEval?.status).toBe(EvaluationStatus.WAITING_FOR_REVIEW);
    expect(updatedEval?.aiMarks).toBe(0); // Incorrect answer
    expect(updatedEval?.teacherMarks).toBe(5); // Still preserved
    expect(updatedEval?.teacherFeedback).toBe('Teacher knows best'); // Still preserved
  });
});
