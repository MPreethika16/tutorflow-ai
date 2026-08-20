import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  EvaluationStatus,
  AssessmentAttemptStatus,
  QuestionType,
} from '../generated/prisma/client';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('Teacher Review Workflow (Integration)', () => {
  let service: AssessmentsService;

  // In-memory state for the workflow
  let mockEvaluation: any;
  let mockAnswer: any;
  let mockQuestion: any;
  let mockAttempt: any;

  const prismaMock = {
    assessmentAttempt: {
      findFirst: jest.fn().mockImplementation((query) => {
        if (query.where.assessment.teacherId !== 'teacher-1') return null;
        if (query.where.attemptId !== mockAttempt.attemptId) return null;
        
        // Re-inject dynamic evaluation state into attempt answers so getAttemptForReview sees updates
        mockAttempt.answers[0].evaluation = mockEvaluation;
        return mockAttempt;
      }),
    },
    studentAnswer: {
      findFirst: jest.fn().mockImplementation((query) => {
        if (query.where.attempt.assessment.teacherId !== 'teacher-1') return null;
        if (query.where.id !== mockAnswer.id) return null;

        return {
          ...mockAnswer,
          question: mockQuestion,
          evaluation: mockEvaluation,
        };
      }),
    },
    answerEvaluation: {
      update: jest.fn().mockImplementation((args) => {
        const { teacherMarks, teacherFeedback, status } = args.data;
        mockEvaluation = {
          ...mockEvaluation,
          teacherMarks: teacherMarks !== undefined ? teacherMarks : mockEvaluation.teacherMarks,
          teacherFeedback:
            teacherFeedback !== undefined ? teacherFeedback : mockEvaluation.teacherFeedback,
          status: status !== undefined ? status : mockEvaluation.status,
        };
        return mockEvaluation;
      }),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AssessmentsService>(AssessmentsService);

    // Reset default state
    mockQuestion = {
      id: 'Q-1',
      marks: 10,
      type: QuestionType.TYPED,
      prompt: 'Q1',
    };
    mockEvaluation = {
      id: 'EVAL-1',
      aiMarks: 7,
      aiFeedback: 'Good AI feedback',
      aiConfidence: 0.9,
      teacherMarks: null,
      teacherFeedback: null,
      status: EvaluationStatus.WAITING_FOR_REVIEW,
    };
    mockAnswer = {
      id: 'ANS-1',
      textAnswer: 'Student text',
      selectedOption: null,
      voiceUrl: null,
    };
    mockAttempt = {
      attemptId: 'ATT-1',
      status: AssessmentAttemptStatus.SUBMITTED,
      submittedAt: new Date(),
      answers: [
        {
          ...mockAnswer,
          question: mockQuestion,
          evaluation: mockEvaluation,
        },
      ],
    };
  });

  it('1. AI-approved-as-is path', async () => {
    const result = await service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {});

    expect(result.status).toBe(EvaluationStatus.APPROVED);
    expect(result.teacherMarks).toBeNull();
    expect(result.teacherFeedback).toBeNull();
    expect(result.finalMarks).toBe(7); // Uses aiMarks
  });

  it('2. Teacher override path', async () => {
    const result = await service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {
      teacherMarks: 5,
    });

    expect(result.status).toBe(EvaluationStatus.APPROVED);
    expect(result.teacherMarks).toBe(5);
    expect(result.finalMarks).toBe(5);
    expect(result.aiMarks).toBe(7); // aiMarks remains unchanged
  });

  it('3. Teacher feedback override', async () => {
    const result = await service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {
      teacherFeedback: 'My feedback',
    });

    expect(result.status).toBe(EvaluationStatus.APPROVED);
    expect(result.teacherFeedback).toBe('My feedback');
    expect(result.aiFeedback).toBe('Good AI feedback'); // unchanged
  });

  it('4. Attempt summary updates (before and after review)', async () => {
    // Before review
    const before = await service.getAttemptForReview('teacher-1', 'ASM-1', 'ATT-1');
    expect(before.summary.reviewComplete).toBe(false);
    expect(before.summary.waitingForReviewAnswers).toBe(1);
    expect(before.summary.approvedAnswers).toBe(0);
    expect(before.summary.totalApprovedMarks).toBe(0);
    expect(before.summary.totalMaximumMarks).toBe(10);

    // Perform review
    await service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {
      teacherMarks: 9,
    });

    // After review
    const after = await service.getAttemptForReview('teacher-1', 'ASM-1', 'ATT-1');
    expect(after.summary.reviewComplete).toBe(true);
    expect(after.summary.waitingForReviewAnswers).toBe(0);
    expect(after.summary.approvedAnswers).toBe(1);
    expect(after.summary.totalApprovedMarks).toBe(9); // finalMarks used (teacher override)
  });

  it('5. Mixed attempt', async () => {
    // Add a second answer that is APPROVED
    mockAttempt.answers.push({
      id: 'ANS-2',
      question: { marks: 5, type: QuestionType.TYPED, prompt: 'Q2' },
      evaluation: {
        status: EvaluationStatus.APPROVED,
        aiMarks: 5,
        teacherMarks: null,
      },
    });

    const before = await service.getAttemptForReview('teacher-1', 'ASM-1', 'ATT-1');
    expect(before.summary.reviewComplete).toBe(false);
    expect(before.summary.totalApprovedMarks).toBe(5); // Only the approved one counts
  });

  it('6. FAILED evaluation prevents reviewComplete', async () => {
    mockEvaluation.status = EvaluationStatus.FAILED;

    const summary = await service.getAttemptForReview('teacher-1', 'ASM-1', 'ATT-1');
    expect(summary.summary.reviewComplete).toBe(false);
    expect(summary.summary.failedEvaluations).toBe(1);
  });

  it('7. Security: wrong teacher cannot fetch or review', async () => {
    await expect(
      service.getAttemptForReview('wrong-teacher', 'ASM-1', 'ATT-1'),
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.reviewAnswer('wrong-teacher', 'ASM-1', 'ATT-1', 'ANS-1', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('8. State protection', async () => {
    const statuses = [
      EvaluationStatus.PENDING,
      EvaluationStatus.EVALUATING,
      EvaluationStatus.FAILED,
      EvaluationStatus.APPROVED, // cannot review twice
    ];

    for (const status of statuses) {
      mockEvaluation.status = status;
      await expect(
        service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {}),
      ).rejects.toThrow(ConflictException);
    }
  });

  it('9. Human override protection', async () => {
    const result = await service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {
      teacherMarks: 10,
      teacherFeedback: 'Perfect',
    });

    expect(result.aiMarks).toBe(7);
    expect(result.aiFeedback).toBe('Good AI feedback');
    expect(result.aiConfidence).toBe(0.9);
  });
});
