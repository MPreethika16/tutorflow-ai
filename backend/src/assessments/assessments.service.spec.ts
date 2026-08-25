import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
      findUnique: jest.fn(),
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
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    studentAnswer: {
      findFirst: jest.fn(),
    },
    answerEvaluation: {
      update: jest.fn(),
    },
    question: {
      findMany: jest.fn(),
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
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
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
          title: 'Assessment 1',
          questions: [
            { marks: 5 }, // answered
            { marks: 10 }, // answered
            { marks: 5 }, // unanswered!
          ],
        },
        student: { userId: 'student-id' },
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

  describe('getAssessmentAnalytics', () => {
    it('throws NotFoundException if assessment does not exist or wrong teacher', async () => {
      prismaMock.assessment.findUnique.mockResolvedValue(null);
      await expect(service.getAssessmentAnalytics('teacher-1', 'ASM-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns nulls for averages when there are no published attempts', async () => {
      prismaMock.assessment.findUnique.mockResolvedValue({
        id: 'db-asm-1',
        assessmentId: 'ASM-1',
        maximumMarks: 10,
        questions: [{ id: 'q-1', questionId: 'Q-1', marks: 10 }],
      });

      // Mix of in-progress and submitted-but-not-published
      prismaMock.assessmentAttempt.findMany.mockResolvedValue([
        { status: AssessmentAttemptStatus.IN_PROGRESS, publishedAt: null, answers: [] },
        { status: AssessmentAttemptStatus.SUBMITTED, publishedAt: null, answers: [] },
      ]);

      const result = await service.getAssessmentAnalytics('teacher-1', 'ASM-1');

      expect(result.summary.totalAttempts).toBe(2);
      expect(result.summary.submittedAttempts).toBe(1);
      expect(result.summary.publishedResults).toBe(0);
      expect(result.summary.averageMarks).toBeNull();
      expect(result.summary.averagePercentage).toBeNull();
      expect(result.summary.highestMarks).toBeNull();
      expect(result.summary.lowestMarks).toBeNull();
      expect(result.questions[0].averageMarks).toBeNull();
      expect(result.questions[0].numberAnswered).toBe(0);
      expect(result.questions[0].numberUnanswered).toBe(0);
    });

    it('calculates averages correctly from published attempts, properly handling unanswered questions', async () => {
      prismaMock.assessment.findUnique.mockResolvedValue({
        id: 'db-asm-1',
        assessmentId: 'ASM-1',
        maximumMarks: 20,
        questions: [
          { id: 'q-1', questionId: 'Q-1', marks: 10 },
          { id: 'q-2', questionId: 'Q-2', marks: 10 },
        ],
      });

      prismaMock.assessmentAttempt.findMany.mockResolvedValue([
        // Published attempt 1 (15 marks)
        {
          status: AssessmentAttemptStatus.SUBMITTED,
          publishedAt: new Date(),
          finalMarks: 15,
          answers: [
            { questionId: 'q-1', evaluation: { aiMarks: 5, teacherMarks: null } },
            { questionId: 'q-2', evaluation: { aiMarks: 5, teacherMarks: 10 } },
          ],
        },
        // Published attempt 2 (5 marks, unanswered q-2)
        {
          status: AssessmentAttemptStatus.SUBMITTED,
          publishedAt: new Date(),
          finalMarks: 5,
          answers: [
            { questionId: 'q-1', evaluation: { aiMarks: 5, teacherMarks: null } },
          ],
        },
      ]);

      const result = await service.getAssessmentAnalytics('teacher-1', 'ASM-1');

      expect(result.summary.publishedResults).toBe(2);
      expect(result.summary.averageMarks).toBe(10); // (15 + 5) / 2
      expect(result.summary.averagePercentage).toBe(50); // 10 / 20 * 100
      expect(result.summary.highestMarks).toBe(15);
      expect(result.summary.lowestMarks).toBe(5);

      // Question 1: answered by both, marks: 5 and 5 -> avg 5
      expect(result.questions[0].numberAnswered).toBe(2);
      expect(result.questions[0].numberUnanswered).toBe(0);
      expect(result.questions[0].averageMarks).toBe(5);
      
      // Question 2: answered by 1, unanswered by 1. marks: 10 and 0 -> avg 5
      expect(result.questions[1].numberAnswered).toBe(1);
      expect(result.questions[1].numberUnanswered).toBe(1);
      expect(result.questions[1].averageMarks).toBe(5);
      expect(result.questions[1].averagePercentage).toBe(50);
    });
  });

  describe('exportResultsForTeacher', () => {
    it('throws NotFoundException if assessment not found', async () => {
      prismaMock.assessment.findUnique.mockResolvedValue(null);
      await expect(service.exportResultsForTeacher('teacher-1', 'ASM-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('generates proper CSV and escapes formula injection and commas', async () => {
      prismaMock.assessment.findUnique.mockResolvedValue({
        id: 'db-asm-1',
        assessmentId: 'ASM-1',
        maximumMarks: 20,
        questions: [
          { id: 'q-1', questionId: 'Q-1', order: 0, marks: 10 },
          { id: 'q-2', questionId: 'Q-2', order: 1, marks: 10 },
        ],
      });

      prismaMock.assessmentAttempt.findMany.mockResolvedValue([
        {
          status: AssessmentAttemptStatus.SUBMITTED,
          submittedAt: new Date('2023-01-01T00:00:00Z'),
          publishedAt: new Date('2023-01-02T00:00:00Z'),
          finalMarks: 15,
          maximumMarks: 20,
          student: { user: { firstName: '=Formula', lastName: 'Name, with comma' } },
          answers: [
            { questionId: 'q-1', evaluation: { aiMarks: 5, teacherMarks: null } },
            { questionId: 'q-2', evaluation: { aiMarks: 5, teacherMarks: 10 } },
          ],
        },
      ]);

      const result = await service.exportResultsForTeacher('teacher-1', 'ASM-1');
      
      const lines = result.trim().split('\n');
      expect(lines.length).toBe(2);
      expect(lines[0]).toBe('Student Name,Final Marks,Maximum Marks,Percentage,Submitted At,Published At,Q1 (10 marks),Q2 (10 marks)');
      // =Formula should be escaped to '=Formula
      // "Name, with comma" should be escaped
      expect(lines[1]).toContain('\'=Formula Name, with comma');
      expect(lines[1]).toContain('15,20,75,');
      // Q1 = 5, Q2 = 10
      expect(lines[1].endsWith(',5,10')).toBe(true);
    });
  });

  describe('listAttemptsForTeacher', () => {
    it('throws NotFoundException if assessment not found', async () => {
      prismaMock.assessment.findUnique.mockResolvedValue(null);
      await expect(service.listAttemptsForTeacher('teacher-1', 'ASM-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('derives correct statuses', async () => {
      prismaMock.assessment.findUnique.mockResolvedValue({ id: 'asm-db-1' });

      prismaMock.assessmentAttempt.findMany.mockResolvedValue([
        {
          attemptId: 'att-1',
          status: AssessmentAttemptStatus.IN_PROGRESS,
          publishedAt: null,
          student: { user: { firstName: 'Alice', lastName: 'A' } },
          answers: [],
        },
        {
          attemptId: 'att-2',
          status: AssessmentAttemptStatus.SUBMITTED,
          publishedAt: new Date(), // PUBLISHED
          student: { user: { firstName: 'Bob', lastName: 'B' } },
          answers: [],
        },
        {
          attemptId: 'att-3',
          status: AssessmentAttemptStatus.SUBMITTED,
          publishedAt: null,
          student: { user: { firstName: 'Charlie', lastName: 'C' } },
          answers: [
            { evaluation: { status: EvaluationStatus.FAILED } },
            { evaluation: { status: EvaluationStatus.APPROVED } },
          ], // FAILED
        },
        {
          attemptId: 'att-4',
          status: AssessmentAttemptStatus.SUBMITTED,
          publishedAt: null,
          student: { user: { firstName: 'Dave', lastName: 'D' } },
          answers: [
            { evaluation: { status: EvaluationStatus.APPROVED } },
            { evaluation: { status: EvaluationStatus.PENDING } },
          ], // GRADING
        },
        {
          attemptId: 'att-5',
          status: AssessmentAttemptStatus.SUBMITTED,
          publishedAt: null,
          student: { user: { firstName: 'Eve', lastName: 'E' } },
          answers: [
            { evaluation: { status: EvaluationStatus.APPROVED } },
            { evaluation: { status: EvaluationStatus.WAITING_FOR_REVIEW } },
          ], // WAITING_FOR_REVIEW
        },
        {
          attemptId: 'att-6',
          status: AssessmentAttemptStatus.SUBMITTED,
          publishedAt: null,
          student: { user: { firstName: 'Frank', lastName: 'F' } },
          answers: [
            { evaluation: { status: EvaluationStatus.APPROVED } },
            { evaluation: { status: EvaluationStatus.APPROVED } },
          ], // READY_TO_PUBLISH
        },
      ]);

      const result = await service.listAttemptsForTeacher('teacher-1', 'ASM-1');
      expect(result.length).toBe(6);
      expect(result[0].derivedStatus).toBe('IN_PROGRESS');
      expect(result[1].derivedStatus).toBe('PUBLISHED');
      expect(result[2].derivedStatus).toBe('FAILED');
      expect(result[3].derivedStatus).toBe('GRADING');
      expect(result[4].derivedStatus).toBe('WAITING_FOR_REVIEW');
      expect(result[5].derivedStatus).toBe('READY_TO_PUBLISH');
    });
  });

  describe('bulkPublishAttemptResults', () => {
    it('throws NotFoundException if assessment not found', async () => {
      prismaMock.assessment.findUnique.mockResolvedValue(null);
      await expect(service.bulkPublishAttemptResults('teacher-1', 'ASM-1', ['att-1'])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('processes attempts independently and handles partial failure', async () => {
      prismaMock.assessment.findUnique.mockResolvedValue({ id: 'asm-db-1', title: 'Assessment Title' });

      // Mock questions for the ready attempt calculation
      prismaMock.question.findMany.mockResolvedValue([
        { id: 'q-1', marks: 10 },
        { id: 'q-2', marks: 10 },
      ]);

      // Provide attempt responses per ID
      prismaMock.assessmentAttempt.findUnique.mockImplementation(async ({ where: { attemptId } }) => {
        if (attemptId === 'att-not-found') return null;
        if (attemptId === 'att-foreign') return { assessmentId: 'foreign-db-1' };
        if (attemptId === 'att-published') return { assessmentId: 'asm-db-1', publishedAt: new Date() };
        if (attemptId === 'att-incomplete') return {
          assessmentId: 'asm-db-1',
          status: AssessmentAttemptStatus.SUBMITTED,
          answers: [
            { evaluation: { status: EvaluationStatus.APPROVED } },
            { evaluation: { status: EvaluationStatus.PENDING } },
          ],
          student: { userId: 'student-1' }
        };
        if (attemptId === 'att-ready') return {
          id: 'ready-db-id',
          attemptId: 'att-ready',
          assessmentId: 'asm-db-1',
          status: AssessmentAttemptStatus.SUBMITTED,
          publishedAt: null,
          answers: [
            { questionId: 'q-1', evaluation: { status: EvaluationStatus.APPROVED, teacherMarks: 10 } },
            { questionId: 'q-2', evaluation: { status: EvaluationStatus.APPROVED, aiMarks: 8 } },
          ],
          student: { userId: 'student-ready' }
        };
        return null;
      });

      const attemptIds = ['att-not-found', 'att-foreign', 'att-published', 'att-incomplete', 'att-ready'];
      
      const result = await service.bulkPublishAttemptResults('teacher-1', 'ASM-1', attemptIds);

      expect(result.successful).toEqual(['att-ready']);
      expect(result.failed.length).toBe(4);
      expect(result.failed.find(f => f.attemptId === 'att-not-found')?.reason).toBe('Not found');
      expect(result.failed.find(f => f.attemptId === 'att-foreign')?.reason).toBe('Not found');
      expect(result.failed.find(f => f.attemptId === 'att-published')?.reason).toBe('Already published');
      expect(result.failed.find(f => f.attemptId === 'att-incomplete')?.reason).toContain('Not ready to publish');

      expect(prismaMock.assessmentAttempt.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.assessmentAttempt.update).toHaveBeenCalledWith({
        where: { id: 'ready-db-id' },
        data: expect.objectContaining({
          finalMarks: 18,
          maximumMarks: 20,
          publishedAt: expect.any(Date)
        }),
      });
    });
  });
});
