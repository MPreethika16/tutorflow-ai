import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
  AssessmentAttemptStatus,
  AssessmentStatus,
  QuestionType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StudentAssessmentsService } from './student-assessments.service';

describe('StudentAssessmentsService', () => {
  let service: StudentAssessmentsService;

  const prismaMock = {
    student: {
      findUnique: jest.fn(),
    },
    assessment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    assessmentAttempt: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    question: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    studentAnswer: {
      upsert: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    answerEvaluation: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const txMock = {
    assessmentAttempt: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    question: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    studentAnswer: {
      upsert: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    answerEvaluation: {
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof txMock) => unknown) =>
        callback(txMock),
    );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          StudentAssessmentsService,
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
        ],
      }).compile();

    service =
      module.get<StudentAssessmentsService>(
        StudentAssessmentsService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startAssessmentForStudent', () => {
    it('throws 404 when the student profile does not exist', async () => {
      prismaMock.student.findUnique.mockResolvedValue(null);

      await expect(
        service.startAssessmentForStudent(
          'student-user-id',
          'ASM-1',
        ),
      ).rejects.toThrow(
        new NotFoundException(
          'Student profile not found',
        ),
      );
    });

    it('throws 404 when the assessment does not exist', async () => {
      prismaMock.student.findUnique.mockResolvedValue({
        userId: 'student-user-id',
        board: 'CBSE',
        grade: '10',
      });
      prismaMock.assessment.findUnique.mockResolvedValue(null);

      await expect(
        service.startAssessmentForStudent(
          'student-user-id',
          'ASM-404',
        ),
      ).rejects.toThrow(
        new NotFoundException(
          'Assessment not found',
        ),
      );
    });

    it('throws 404 when board or grade does not match', async () => {
      prismaMock.student.findUnique.mockResolvedValue({
        userId: 'student-user-id',
        board: 'CBSE',
        grade: '10',
      });
      prismaMock.assessment.findUnique.mockResolvedValue({
        id: 'assessment-db-id',
        assessmentId: 'ASM-1',
        title: 'Test',
        board: 'ICSE',
        grade: '10',
        status: AssessmentStatus.PUBLISHED,
        durationMinutes: 60,
        maximumMarks: 10,
        startAt: new Date(Date.now() - 60_000),
        endAt: new Date(Date.now() + 60_000),
        _count: { questions: 1 },
      });

      await expect(
        service.startAssessmentForStudent(
          'student-user-id',
          'ASM-1',
        ),
      ).rejects.toThrow(
        new NotFoundException(
          'Assessment not found',
        ),
      );
    });

    it('throws 409 when the assessment has not started yet', async () => {
      prismaMock.student.findUnique.mockResolvedValue({
        userId: 'student-user-id',
        board: 'CBSE',
        grade: '10',
      });
      prismaMock.assessment.findUnique.mockResolvedValue({
        id: 'assessment-db-id',
        assessmentId: 'ASM-1',
        title: 'Test',
        board: 'CBSE',
        grade: '10',
        status: AssessmentStatus.PUBLISHED,
        durationMinutes: 60,
        maximumMarks: 10,
        startAt: new Date(Date.now() + 60 * 60 * 1000),
        endAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        _count: { questions: 1 },
      });

      await expect(
        service.startAssessmentForStudent(
          'student-user-id',
          'ASM-1',
        ),
      ).rejects.toThrow(
        new ConflictException(
          'Assessment has not started yet',
        ),
      );
    });

    it('throws 409 when the assessment window has ended', async () => {
      prismaMock.student.findUnique.mockResolvedValue({
        userId: 'student-user-id',
        board: 'CBSE',
        grade: '10',
      });
      prismaMock.assessment.findUnique.mockResolvedValue({
        id: 'assessment-db-id',
        assessmentId: 'ASM-1',
        title: 'Test',
        board: 'CBSE',
        grade: '10',
        status: AssessmentStatus.PUBLISHED,
        durationMinutes: 60,
        maximumMarks: 10,
        startAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endAt: new Date(Date.now() - 60_000),
        _count: { questions: 1 },
      });

      await expect(
        service.startAssessmentForStudent(
          'student-user-id',
          'ASM-1',
        ),
      ).rejects.toThrow(
        new ConflictException(
          'Assessment has expired',
        ),
      );
    });

    it('returns an existing active attempt instead of creating another one', async () => {
      const now = Date.now();

      prismaMock.student.findUnique.mockResolvedValue({
        userId: 'student-user-id',
        board: 'CBSE',
        grade: '10',
      });
      prismaMock.assessment.findUnique.mockResolvedValue({
        id: 'assessment-db-id',
        assessmentId: 'ASM-1',
        title: 'Test',
        board: 'CBSE',
        grade: '10',
        status: AssessmentStatus.PUBLISHED,
        durationMinutes: 60,
        maximumMarks: 10,
        startAt: new Date(now - 60_000),
        endAt: new Date(now + 2 * 60 * 60 * 1000),
        _count: { questions: 1 },
      });
      prismaMock.assessmentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-db-id',
        attemptId: 'ATT-EXISTING',
        status: AssessmentAttemptStatus.IN_PROGRESS,
        startedAt: new Date(now - 30_000),
        expiresAt: new Date(now + 60_000),
      });

      const result =
        await service.startAssessmentForStudent(
          'student-user-id',
          'ASM-1',
        );

      expect(result.created).toBe(false);
      expect(result.data.attempt.attemptId).toBe(
        'ATT-EXISTING',
      );
      expect(
        prismaMock.assessmentAttempt.create,
      ).not.toHaveBeenCalled();
    });

    it('throws 409 when the existing attempt is already submitted', async () => {
      const now = Date.now();

      prismaMock.student.findUnique.mockResolvedValue({
        userId: 'student-user-id',
        board: 'CBSE',
        grade: '10',
      });
      prismaMock.assessment.findUnique.mockResolvedValue({
        id: 'assessment-db-id',
        assessmentId: 'ASM-1',
        title: 'Test',
        board: 'CBSE',
        grade: '10',
        status: AssessmentStatus.PUBLISHED,
        durationMinutes: 60,
        maximumMarks: 10,
        startAt: new Date(now - 60_000),
        endAt: new Date(now + 60_000),
        _count: { questions: 1 },
      });
      prismaMock.assessmentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-db-id',
        attemptId: 'ATT-SUBMITTED',
        status: AssessmentAttemptStatus.SUBMITTED,
        startedAt: new Date(now - 30_000),
        expiresAt: new Date(now + 30_000),
      });

      await expect(
        service.startAssessmentForStudent(
          'student-user-id',
          'ASM-1',
        ),
      ).rejects.toThrow(
        new ConflictException(
          'Assessment already attempted',
        ),
      );
    });
  });

  describe('saveAnswerForStudent', () => {
    it('saves a valid MCQ answer case-insensitively', async () => {
      txMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-db-id',
        status: AssessmentAttemptStatus.IN_PROGRESS,
        expiresAt: new Date(Date.now() + 60_000),
        assessmentId: 'assessment-db-id',
      });
      txMock.question.findFirst.mockResolvedValue({
        id: 'question-db-id',
        questionId: 'QUE-1',
        type: QuestionType.MCQ,
        options: [
          { id: 'A', text: 'Alpha' },
          { id: 'B', text: 'Beta' },
        ],
      });
      txMock.studentAnswer.upsert.mockResolvedValue({
        selectedOption: 'B',
        textAnswer: null,
        voiceUrl: null,
        updatedAt: new Date(),
      });

      const result =
        await service.saveAnswerForStudent(
          'student-user-id',
          'ATT-1',
          'QUE-1',
          { selectedOption: 'b' },
        );

      expect(txMock.studentAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ selectedOption: 'B' }),
          update: expect.objectContaining({ selectedOption: 'B' }),
        }),
      );
      expect(result.answer.selectedOption).toBe('B');
    });

    it('rejects an invalid MCQ option', async () => {
      txMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-db-id',
        status: AssessmentAttemptStatus.IN_PROGRESS,
        expiresAt: new Date(Date.now() + 60_000),
        assessmentId: 'assessment-db-id',
      });
      txMock.question.findFirst.mockResolvedValue({
        id: 'question-db-id',
        questionId: 'QUE-1',
        type: QuestionType.MCQ,
        options: [
          { id: 'A', text: 'Alpha' },
          { id: 'B', text: 'Beta' },
        ],
      });

      await expect(
        service.saveAnswerForStudent(
          'student-user-id',
          'ATT-1',
          'QUE-1',
          { selectedOption: 'Z' },
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Selected option is invalid',
        ),
      );
    });

    it('clears an MCQ answer when selectedOption is null', async () => {
      txMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-db-id',
        status: AssessmentAttemptStatus.IN_PROGRESS,
        expiresAt: new Date(Date.now() + 60_000),
        assessmentId: 'assessment-db-id',
      });
      txMock.question.findFirst.mockResolvedValue({
        id: 'question-db-id',
        questionId: 'QUE-1',
        type: QuestionType.MCQ,
        options: [{ id: 'A', text: 'Alpha' }],
      });
      txMock.studentAnswer.upsert.mockResolvedValue({
        selectedOption: null,
        textAnswer: null,
        voiceUrl: null,
        updatedAt: new Date(),
      });

      const result =
        await service.saveAnswerForStudent(
          'student-user-id',
          'ATT-1',
          'QUE-1',
          { selectedOption: null },
        );

      expect(txMock.studentAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            selectedOption: null,
            textAnswer: null,
            voiceUrl: null,
          }),
        }),
      );
      expect(result.answer.selectedOption).toBeNull();
    });

    it('rejects saving an answer to another student attempt', async () => {
      txMock.assessmentAttempt.findFirst.mockResolvedValue(null);

      await expect(
        service.saveAnswerForStudent(
          'student-b',
          'ATT-STUDENT-A',
          'QUE-1',
          { textAnswer: 'Nope' },
        ),
      ).rejects.toThrow(
        new NotFoundException(
          'Assessment attempt not found',
        ),
      );

      expect(
        txMock.studentAnswer.upsert,
      ).not.toHaveBeenCalled();
    });

    it('auto-submits an expired attempt before rejecting a late answer', async () => {
      const expiresAt = new Date(Date.now() - 60_000);

      txMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-db-id',
        status: AssessmentAttemptStatus.IN_PROGRESS,
        expiresAt,
        assessmentId: 'assessment-db-id',
      });
      txMock.assessmentAttempt.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.saveAnswerForStudent(
          'student-user-id',
          'ATT-1',
          'QUE-1',
          { textAnswer: 'Too late' },
        ),
      ).rejects.toThrow(
        new ConflictException(
          'Assessment attempt has expired',
        ),
      );

      expect(txMock.assessmentAttempt.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: AssessmentAttemptStatus.SUBMITTED,
            submittedAt: expiresAt,
          },
        }),
      );
      expect(
        txMock.studentAnswer.upsert,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getAttemptForStudent', () => {
    it('returns 404 when reading another student attempt', async () => {
      prismaMock.assessmentAttempt.findFirst.mockResolvedValue(null);

      await expect(
        service.getAttemptForStudent(
          'student-b',
          'ATT-STUDENT-A',
        ),
      ).rejects.toThrow(
        new NotFoundException(
          'Assessment attempt not found',
        ),
      );
    });

    it('auto-submits an expired attempt when resumed', async () => {
      const expiresAt = new Date(Date.now() - 60_000);

      prismaMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-db-id',
        attemptId: 'ATT-1',
        status: AssessmentAttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60 * 60 * 1000),
        expiresAt,
        submittedAt: null,
        assessment: {
          assessmentId: 'ASM-1',
          title: 'Assessment',
          subject: 'Science',
          durationMinutes: 60,
          maximumMarks: 10,
          instructions: null,
          questions: [],
        },
        answers: [],
      });
      prismaMock.assessmentAttempt.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.assessmentAttempt.findUnique.mockResolvedValue({
        status: AssessmentAttemptStatus.SUBMITTED,
        submittedAt: expiresAt,
      });

      const result =
        await service.getAttemptForStudent(
          'student-user-id',
          'ATT-1',
        );

      expect(result.attempt.status).toBe(
        AssessmentAttemptStatus.SUBMITTED,
      );
      expect(result.attempt.submittedAt).toEqual(expiresAt);
    });

    it('returns only student-safe question fields', async () => {
      prismaMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-db-id',
        attemptId: 'ATT-1',
        status: AssessmentAttemptStatus.IN_PROGRESS,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        submittedAt: null,
        assessment: {
          assessmentId: 'ASM-1',
          title: 'Assessment',
          subject: 'Science',
          durationMinutes: 60,
          maximumMarks: 10,
          instructions: null,
          questions: [
            {
              id: 'question-db-id',
              questionId: 'QUE-1',
              type: QuestionType.MCQ,
              prompt: 'Pick one',
              marks: 2,
              order: 1,
              options: [
                {
                  id: 'A',
                  text: 'Alpha',
                  secret: 'should not leak',
                },
              ],
            },
          ],
        },
        answers: [],
      });

      const result =
        await service.getAttemptForStudent(
          'student-user-id',
          'ATT-1',
        );

      expect(result.questions[0]).toEqual({
        questionId: 'QUE-1',
        type: QuestionType.MCQ,
        prompt: 'Pick one',
        marks: 2,
        order: 1,
        options: [{ id: 'A', text: 'Alpha' }],
        answer: null,
      });

      expect(result.questions[0]).not.toHaveProperty('correctOption');
      expect(result.questions[0]).not.toHaveProperty('modelAnswer');
      expect(result.questions[0]).not.toHaveProperty('explanation');
      expect(result.questions[0]).not.toHaveProperty('gradingInstructions');
    });
  });

  describe('submitAttemptForStudent', () => {
    it('submits an active attempt and returns answer counts', async () => {
      txMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-db-id',
        attemptId: 'ATT-1',
        status: AssessmentAttemptStatus.IN_PROGRESS,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        submittedAt: null,
        assessmentId: 'assessment-db-id',
      });
      txMock.question.count.mockResolvedValue(3);
      txMock.studentAnswer.count.mockResolvedValue(2);
      txMock.assessmentAttempt.updateMany.mockResolvedValue({ count: 1 });

      const submittedAt = new Date();

      txMock.assessmentAttempt.findUniqueOrThrow.mockResolvedValue({
        attemptId: 'ATT-1',
        status: AssessmentAttemptStatus.SUBMITTED,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        submittedAt,
      });

      const result =
        await service.submitAttemptForStudent(
          'student-user-id',
          'ATT-1',
        );

      expect(result.attempt.status).toBe(
        AssessmentAttemptStatus.SUBMITTED,
      );
      expect(result.answeredQuestions).toBe(2);
      expect(result.totalQuestions).toBe(3);
    });

    it('throws 409 when the attempt is already submitted', async () => {
      txMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-db-id',
        attemptId: 'ATT-1',
        status: AssessmentAttemptStatus.SUBMITTED,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        submittedAt: new Date(),
        assessmentId: 'assessment-db-id',
      });

      await expect(
        service.submitAttemptForStudent(
          'student-user-id',
          'ATT-1',
        ),
      ).rejects.toThrow(
        new ConflictException(
          'Assessment attempt already submitted',
        ),
      );
    });

    it('auto-submits an expired attempt using expiresAt as submittedAt', async () => {
      const expiresAt = new Date(Date.now() - 60_000);

      txMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-db-id',
        attemptId: 'ATT-1',
        status: AssessmentAttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60 * 60 * 1000),
        expiresAt,
        submittedAt: null,
        assessmentId: 'assessment-db-id',
      });
      txMock.question.count.mockResolvedValue(2);
      txMock.studentAnswer.count.mockResolvedValue(1);
      txMock.assessmentAttempt.updateMany.mockResolvedValue({ count: 1 });
      txMock.assessmentAttempt.findUniqueOrThrow.mockResolvedValue({
        attemptId: 'ATT-1',
        status: AssessmentAttemptStatus.SUBMITTED,
        startedAt: new Date(),
        expiresAt,
        submittedAt: expiresAt,
      });

      const result =
        await service.submitAttemptForStudent(
          'student-user-id',
          'ATT-1',
        );

      expect(txMock.assessmentAttempt.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: AssessmentAttemptStatus.SUBMITTED,
            submittedAt: expiresAt,
          },
        }),
      );
      expect(result.attempt.submittedAt).toEqual(expiresAt);
    });

    it('throws conflict when a concurrent manual submit loses the update race', async () => {
      txMock.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-db-id',
        attemptId: 'ATT-1',
        status: AssessmentAttemptStatus.IN_PROGRESS,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        submittedAt: null,
        assessmentId: 'assessment-db-id',
      });
      txMock.question.count.mockResolvedValue(1);
      txMock.studentAnswer.count.mockResolvedValue(1);
      txMock.assessmentAttempt.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.submitAttemptForStudent(
          'student-user-id',
          'ATT-1',
        ),
      ).rejects.toThrow(
        new ConflictException(
          'Assessment attempt already submitted',
        ),
      );

      expect(
        txMock.assessmentAttempt.findUniqueOrThrow,
      ).not.toHaveBeenCalled();
    });
  });
});