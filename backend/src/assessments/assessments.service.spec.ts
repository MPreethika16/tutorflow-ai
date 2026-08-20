import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
  AssessmentAttemptStatus,
  EvaluationStatus,
  QuestionType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentsService } from './assessments.service';

describe('AssessmentsService', () => {
  let service: AssessmentsService;

  const prismaMock = {
    assessment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    teacher: {
      findUnique: jest.fn(),
    },
    assessmentAttempt: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    studentAnswer: {
      findFirst: jest.fn(),
    },
    answerEvaluation: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<AssessmentsService>(AssessmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAttemptForReview', () => {
    it('throws NotFoundException when attempt does not exist or wrong teacher', async () => {
      prismaMock.assessmentAttempt.findFirst.mockResolvedValue(null);

      await expect(
        service.getAttemptForReview('teacher-user-id', 'ASM-1', 'ATT-1'),
      ).rejects.toThrow(new NotFoundException('Assessment attempt not found'));

      expect(prismaMock.assessmentAttempt.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            attemptId: 'ATT-1',
            assessment: {
              assessmentId: 'ASM-1',
              teacherId: 'teacher-user-id',
            },
          },
        }),
      );
    });

    it('returns attempt, answers, questions, evaluations, and summary', async () => {
      const mockAttempt = {
        attemptId: 'ATT-1',
        status: AssessmentAttemptStatus.SUBMITTED,
        submittedAt: new Date(),
        answers: [
          {
            id: 'answer-1',
            selectedOption: null,
            textAnswer: 'Some answer',
            voiceUrl: null,
            question: {
              id: 'q-1',
              prompt: 'Question 1',
              type: QuestionType.TYPED,
              marks: 5,
              modelAnswer: 'Correct answer',
              gradingInstructions: 'Check keywords',
            },
            evaluation: {
              aiMarks: 4,
              aiFeedback: 'Good',
              aiReasoning: 'Mentioned keywords',
              aiConfidence: 0.9,
              teacherMarks: null,
              teacherFeedback: null,
              status: EvaluationStatus.WAITING_FOR_REVIEW,
            },
          },
          {
            id: 'answer-2',
            selectedOption: null,
            textAnswer: 'Another answer',
            voiceUrl: null,
            question: {
              id: 'q-2',
              prompt: 'Question 2',
              type: QuestionType.TYPED,
              marks: 5,
              modelAnswer: null,
              gradingInstructions: null,
            },
            evaluation: {
              aiMarks: 0,
              aiFeedback: 'Bad',
              aiReasoning: 'Wrong',
              aiConfidence: 0.8,
              teacherMarks: null,
              teacherFeedback: null,
              status: EvaluationStatus.FAILED,
            },
          },
        ],
      };

      prismaMock.assessmentAttempt.findFirst.mockResolvedValue(mockAttempt);

      const result = await service.getAttemptForReview(
        'teacher-user-id',
        'ASM-1',
        'ATT-1',
      );

      expect(result.attempt.attemptId).toEqual('ATT-1');
      expect(result.attempt.status).toEqual(AssessmentAttemptStatus.SUBMITTED);
      expect(result.answers.length).toEqual(2);
      expect(result.answers[0].question.prompt).toEqual('Question 1');
      expect(result.answers[0].evaluation!.status).toEqual(
        EvaluationStatus.WAITING_FOR_REVIEW,
      );

      expect(result.summary).toEqual({
        totalAnswers: 2,
        approvedAnswers: 0,
        waitingForReviewAnswers: 1,
        failedEvaluations: 1,
        totalMaximumMarks: 10,
        totalApprovedMarks: 0,
        reviewComplete: false,
      });
    });

    it('sets reviewComplete to true if all evaluations are APPROVED', async () => {
      const mockAttempt = {
        attemptId: 'ATT-2',
        status: AssessmentAttemptStatus.SUBMITTED,
        submittedAt: new Date(),
        answers: [
          {
            id: 'answer-1',
            selectedOption: null,
            textAnswer: 'Ans',
            voiceUrl: null,
            question: {
              id: 'q-1',
              prompt: 'Q1',
              type: QuestionType.TYPED,
              marks: 5,
              modelAnswer: null,
              gradingInstructions: null,
            },
            evaluation: {
              aiMarks: 5,
              aiFeedback: 'Ok',
              aiReasoning: 'Ok',
              aiConfidence: 0.9,
              teacherMarks: 5,
              teacherFeedback: 'Ok',
              status: EvaluationStatus.APPROVED,
            },
          },
        ],
      };

      prismaMock.assessmentAttempt.findFirst.mockResolvedValue(mockAttempt);

      const result = await service.getAttemptForReview(
        'teacher-user-id',
        'ASM-1',
        'ATT-2',
      );

      expect(result.summary.approvedAnswers).toEqual(1);
      expect(result.summary.reviewComplete).toEqual(true);
      expect(result.summary.totalApprovedMarks).toEqual(5);
    });

    it('sets reviewComplete to false if there are no evaluations', async () => {
      const mockAttempt = {
        attemptId: 'ATT-3',
        status: AssessmentAttemptStatus.SUBMITTED,
        submittedAt: new Date(),
        answers: [
          {
            id: 'answer-1',
            selectedOption: 'A',
            textAnswer: null,
            voiceUrl: null,
            question: {
              id: 'q-1',
              prompt: 'MCQ',
              type: QuestionType.MCQ,
              marks: 1,
              modelAnswer: null,
              gradingInstructions: null,
            },
            evaluation: null, // No evaluation for MCQ usually
          },
        ],
      };

      prismaMock.assessmentAttempt.findFirst.mockResolvedValue(mockAttempt);

      const result = await service.getAttemptForReview(
        'teacher-user-id',
        'ASM-1',
        'ATT-3',
      );

      expect(result.summary.totalAnswers).toEqual(1);
      expect(result.summary.approvedAnswers).toEqual(0);
      expect(result.summary.reviewComplete).toEqual(false);
      expect(result.summary.totalMaximumMarks).toEqual(1);
    });
  });

  describe('reviewAnswer', () => {
    it('throws NotFoundException when answer does not exist or wrong ownership chain', async () => {
      prismaMock.studentAnswer.findFirst.mockResolvedValue(null);

      await expect(
        service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {}),
      ).rejects.toThrow(new NotFoundException('Answer not found'));

      expect(prismaMock.studentAnswer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'ANS-1',
            attempt: {
              attemptId: 'ATT-1',
              assessment: {
                assessmentId: 'ASM-1',
                teacherId: 'teacher-1',
              },
            },
          },
        }),
      );
    });

    it('throws ConflictException if evaluation does not exist', async () => {
      prismaMock.studentAnswer.findFirst.mockResolvedValue({
        id: 'ANS-1',
        evaluation: null,
      });

      await expect(
        service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {}),
      ).rejects.toThrow(/Answer evaluation is not in WAITING_FOR_REVIEW status/);
    });

    it.each([
      EvaluationStatus.PENDING,
      EvaluationStatus.EVALUATING,
      EvaluationStatus.FAILED,
      EvaluationStatus.APPROVED,
    ])('throws ConflictException if evaluation status is %s', async (status) => {
      prismaMock.studentAnswer.findFirst.mockResolvedValue({
        id: 'ANS-1',
        evaluation: { status },
      });

      await expect(
        service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {}),
      ).rejects.toThrow(/Answer evaluation is not in WAITING_FOR_REVIEW status/);
    });

    it('rejects teacherMarks below 0', async () => {
      prismaMock.studentAnswer.findFirst.mockResolvedValue({
        id: 'ANS-1',
        question: { marks: 5 },
        evaluation: { status: EvaluationStatus.WAITING_FOR_REVIEW },
      });

      await expect(
        service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {
          teacherMarks: -1,
        }),
      ).rejects.toThrow(/between 0 and maximum question marks/);
    });

    it('rejects teacherMarks above question marks', async () => {
      prismaMock.studentAnswer.findFirst.mockResolvedValue({
        id: 'ANS-1',
        question: { marks: 5 },
        evaluation: { status: EvaluationStatus.WAITING_FOR_REVIEW },
      });

      await expect(
        service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {
          teacherMarks: 6,
        }),
      ).rejects.toThrow(/between 0 and maximum question marks/);
    });

    it('rejects whitespace-only teacherFeedback', async () => {
      prismaMock.studentAnswer.findFirst.mockResolvedValue({
        id: 'ANS-1',
        question: { marks: 5 },
        evaluation: { status: EvaluationStatus.WAITING_FOR_REVIEW },
      });

      await expect(
        service.reviewAnswer('teacher-1', 'ASM-1', 'ATT-1', 'ANS-1', {
          teacherFeedback: '   \n  ',
        }),
      ).rejects.toThrow(/whitespace only/);
    });

    it('owner teacher can approve AI result unchanged and it sets APPROVED status with finalMarks = aiMarks', async () => {
      prismaMock.studentAnswer.findFirst.mockResolvedValue({
        id: 'ANS-1',
        question: { marks: 5 },
        evaluation: {
          id: 'EVAL-1',
          status: EvaluationStatus.WAITING_FOR_REVIEW,
        },
      });

      prismaMock.answerEvaluation.update.mockResolvedValue({
        aiMarks: 4,
        aiFeedback: 'Good',
        aiConfidence: 0.9,
        teacherMarks: null,
        teacherFeedback: null,
        status: EvaluationStatus.APPROVED,
      });

      const result = await service.reviewAnswer(
        'teacher-1',
        'ASM-1',
        'ATT-1',
        'ANS-1',
        {},
      );

      expect(prismaMock.answerEvaluation.update).toHaveBeenCalledWith({
        where: { id: 'EVAL-1' },
        data: {
          teacherMarks: undefined,
          teacherFeedback: undefined,
          status: EvaluationStatus.APPROVED,
        },
        select: expect.any(Object),
      });

      expect(result.teacherMarks).toBeNull();
      expect(result.finalMarks).toBe(4);
    });

    it('teacher can override marks and feedback, setting finalMarks = teacherMarks', async () => {
      prismaMock.studentAnswer.findFirst.mockResolvedValue({
        id: 'ANS-1',
        question: { marks: 5 },
        evaluation: {
          id: 'EVAL-1',
          status: EvaluationStatus.WAITING_FOR_REVIEW,
        },
      });

      prismaMock.answerEvaluation.update.mockResolvedValue({
        aiMarks: 4,
        aiFeedback: 'Good',
        aiConfidence: 0.9,
        teacherMarks: 5,
        teacherFeedback: 'Excellent point',
        status: EvaluationStatus.APPROVED,
      });

      const result = await service.reviewAnswer(
        'teacher-1',
        'ASM-1',
        'ATT-1',
        'ANS-1',
        { teacherMarks: 5, teacherFeedback: '  Excellent point  ' },
      );

      expect(prismaMock.answerEvaluation.update).toHaveBeenCalledWith({
        where: { id: 'EVAL-1' },
        data: {
          teacherMarks: 5,
          teacherFeedback: 'Excellent point',
          status: EvaluationStatus.APPROVED,
        },
        select: expect.any(Object),
      });

      expect(result.teacherMarks).toBe(5);
      expect(result.teacherFeedback).toBe('Excellent point');
      expect(result.finalMarks).toBe(5);
    });
  });

  describe('publishAttemptResult', () => {
    it('throws ConflictException if attempt is not SUBMITTED', async () => {
      prismaMock.assessmentAttempt.findFirst.mockResolvedValue({
        status: AssessmentAttemptStatus.IN_PROGRESS,
      });

      await expect(
        service.publishAttemptResult('teacher-1', 'ASM-1', 'ATT-1'),
      ).rejects.toThrow('Cannot publish result: Attempt is not submitted');
    });

    it('throws ConflictException if any evaluation is not APPROVED', async () => {
      prismaMock.assessmentAttempt.findFirst.mockResolvedValue({
        status: AssessmentAttemptStatus.SUBMITTED,
        answers: [
          {
            evaluation: {
              status: EvaluationStatus.WAITING_FOR_REVIEW,
            },
          },
        ],
      });

      await expect(
        service.publishAttemptResult('teacher-1', 'ASM-1', 'ATT-1'),
      ).rejects.toThrow('Cannot publish result: Grading is incomplete or evaluations are pending/failed');
    });

    it('calculates total marks including unanswered questions and updates attempt', async () => {
      prismaMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-id',
        attemptId: 'ATT-1',
        status: AssessmentAttemptStatus.SUBMITTED,
        assessment: {
          questions: [
            { marks: 5 }, // answered
            { marks: 10 }, // answered
            { marks: 5 }, // unanswered!
          ],
        },
        answers: [
          {
            evaluation: {
              teacherMarks: 4,
              aiMarks: null,
              status: EvaluationStatus.APPROVED,
            },
          },
          {
            evaluation: {
              teacherMarks: null,
              aiMarks: 8,
              status: EvaluationStatus.APPROVED,
            },
          },
        ],
      });

      const result = await service.publishAttemptResult('teacher-1', 'ASM-1', 'ATT-1');

      expect(prismaMock.assessmentAttempt.update).toHaveBeenCalledWith({
        where: { id: 'attempt-id' },
        data: {
          finalMarks: 12, // 4 + 8
          maximumMarks: 20, // 5 + 10 + 5
          publishedAt: expect.any(Date),
        },
      });

      expect(result.finalMarks).toBe(12);
      expect(result.maximumMarks).toBe(20);
    });

    it('is idempotent: returns existing snapshot without updating if already published', async () => {
      const existingDate = new Date('2025-01-01T00:00:00.000Z');
      prismaMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-id',
        attemptId: 'ATT-1',
        status: AssessmentAttemptStatus.SUBMITTED,
        publishedAt: existingDate,
        finalMarks: 42,
        maximumMarks: 100,
        answers: [], // Validation will pass because it checks existing evaluations, which are empty
      });

      const result = await service.publishAttemptResult('teacher-1', 'ASM-1', 'ATT-1');

      expect(prismaMock.assessmentAttempt.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        attemptId: 'ATT-1',
        finalMarks: 42,
        maximumMarks: 100,
        publishedAt: existingDate,
      });
    });
  });
});
