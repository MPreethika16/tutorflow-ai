import { Test, TestingModule } from '@nestjs/testing';

import {
  AssessmentKind,
  AssessmentStatus,
  ContentSource,
  Prisma,
  QuestionType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

import { GeneratedPaperPersistenceService } from './generated-paper-persistence.service';

describe('GeneratedPaperPersistenceService', () => {
  let service: GeneratedPaperPersistenceService;

  const assessmentCreateMock = jest.fn();
  const questionCreateMock = jest.fn();

  const transactionMock = jest.fn();

  const prismaMock = {
    $transaction: transactionMock,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    transactionMock.mockImplementation(
      async (
        callback: (tx: {
          assessment: {
            create: typeof assessmentCreateMock;
          };
          question: {
            create: typeof questionCreateMock;
          };
        }) => Promise<unknown>,
      ) => {
        return callback({
          assessment: {
            create: assessmentCreateMock,
          },
          question: {
            create: questionCreateMock,
          },
        });
      },
    );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          GeneratedPaperPersistenceService,
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
        ],
      }).compile();

    service =
      module.get<GeneratedPaperPersistenceService>(
        GeneratedPaperPersistenceService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('saves an AI-generated TEST as DRAFT', async () => {
    assessmentCreateMock.mockResolvedValue({
      id: 'assessment-db-id',
      assessmentId: 'ASM-TEST-001',
      title: 'Quadratic Equations Test',
      board: 'CBSE',
      grade: '10',
      subject: 'Mathematics',
      kind: AssessmentKind.TEST,
      source: ContentSource.AI_GENERATED,
      durationMinutes: 30,
      instructions:
        'Answer all questions.',
      maximumMarks: 5,
      status: AssessmentStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    questionCreateMock.mockResolvedValue({
      id: 'question-id',
    });

    const result =
      await service.saveDraft(
        'teacher-user-id',
        {
          board: 'CBSE',
          grade: '10',
          subject: 'Mathematics',
          topic: 'Quadratic Equations',
          kind: AssessmentKind.TEST,
          totalMarks: 5,
          durationMinutes: 30,
        },
        {
          title:
            'Quadratic Equations Test',

          instructions: [
            'Answer all questions.',
          ],

          durationMinutes: 30,

          totalMarks: 5,

          questions: [
            {
              type: 'MCQ',
              prompt:
                'Which expression is quadratic?',
              marks: 1,
              difficulty: 'EASY',

              options: [
                {
                  id: 'A',
                  text: 'x + 1',
                },
                {
                  id: 'B',
                  text:
                    'x² + 2x + 1',
                },
              ],

              correctOption: 'B',

              explanation:
                'The highest power is 2.',
            },

            {
              type: 'SHORT_ANSWER',
              prompt:
                'What does the discriminant tell us?',
              marks: 4,
              difficulty: 'MEDIUM',

              modelAnswer:
                'It tells us the nature of the roots.',

              gradingInstructions:
                'Award marks for correctly explaining the nature of the roots.',
            },
          ],
        },
      );

    expect(
      transactionMock,
    ).toHaveBeenCalledTimes(1);

    expect(
      assessmentCreateMock,
    ).toHaveBeenCalledTimes(1);

    expect(
      assessmentCreateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data:
          expect.objectContaining({
            teacherId:
              'teacher-user-id',

            board: 'CBSE',
            grade: '10',
            subject: 'Mathematics',

            kind:
              AssessmentKind.TEST,

            source:
              ContentSource.AI_GENERATED,

            durationMinutes: 30,

            maximumMarks: 5,

            status:
              AssessmentStatus.DRAFT,

            startAt: null,
            endAt: null,
          }),
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind:
          AssessmentKind.TEST,

        source:
          ContentSource.AI_GENERATED,

        status:
          AssessmentStatus.DRAFT,

        maximumMarks: 5,
      }),
    );
  });

  it('creates all generated questions with sequential order', async () => {
    assessmentCreateMock.mockResolvedValue({
      id: 'assessment-db-id',
      assessmentId:
        'ASM-TEST-002',
    });

    questionCreateMock.mockResolvedValue({
      id: 'question-db-id',
    });

    await service.saveDraft(
      'teacher-user-id',
      {
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
        topic:
          'Quadratic Equations',
        kind:
          AssessmentKind.TEST,
        totalMarks: 2,
        durationMinutes: 20,
      },
      {
        title:
          'Quadratic Equations Test',

        instructions: [
          'Answer all questions.',
        ],

        durationMinutes: 20,

        totalMarks: 2,

        questions: [
          {
            type: 'TRUE_FALSE',

            prompt:
              'A quadratic equation has degree 2.',

            marks: 1,

            difficulty: 'EASY',

            correctAnswer: true,

            explanation:
              'Quadratic equations are second-degree equations.',
          },

          {
            type: 'FILL_BLANK',

            prompt:
              'The degree of a quadratic equation is ___.',

            marks: 1,

            difficulty: 'EASY',

            expectedAnswer: '2',

            explanation:
              'Quadratic equations have degree 2.',
          },
        ],
      },
    );

    expect(
      questionCreateMock,
    ).toHaveBeenCalledTimes(2);

    const firstCall =
      questionCreateMock.mock.calls[0][0];

    const secondCall =
      questionCreateMock.mock.calls[1][0];

    expect(
      firstCall.data.order,
    ).toBe(1);

    expect(
      secondCall.data.order,
    ).toBe(2);
  });

  it('maps TRUE_FALSE to persisted MCQ options', async () => {
    assessmentCreateMock.mockResolvedValue({
      id: 'assessment-db-id',
      assessmentId:
        'ASM-TEST-003',
    });

    questionCreateMock.mockResolvedValue({
      id: 'question-db-id',
    });

    await service.saveDraft(
      'teacher-user-id',
      {
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
        topic:
          'Quadratic Equations',
        kind:
          AssessmentKind.PRACTICE,
        totalMarks: 1,
        durationMinutes: 10,
      },
      {
        title:
          'Quadratic Equations Practice',

        instructions: [
          'Answer the question.',
        ],

        durationMinutes: 10,

        totalMarks: 1,

        questions: [
          {
            type: 'TRUE_FALSE',

            prompt:
              'A quadratic equation has degree 2.',

            marks: 1,

            difficulty: 'EASY',

            correctAnswer: false,

            explanation:
              'This statement is false for this test case.',
          },
        ],
      },
    );

    const call =
      questionCreateMock.mock.calls[0][0];

    expect(
      call.data.type,
    ).toBe(QuestionType.MCQ);

    expect(
      call.data.options,
    ).toEqual([
      {
        id: 'A',
        text: 'True',
      },
      {
        id: 'B',
        text: 'False',
      },
    ]);

    expect(
      call.data.correctOption,
    ).toBe('B');
  });

  it('stores typed questions with DbNull options', async () => {
    assessmentCreateMock.mockResolvedValue({
      id: 'assessment-db-id',
      assessmentId:
        'ASM-TEST-004',
    });

    questionCreateMock.mockResolvedValue({
      id: 'question-db-id',
    });

    await service.saveDraft(
      'teacher-user-id',
      {
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
        topic:
          'Quadratic Equations',
        kind:
          AssessmentKind.TEST,
        totalMarks: 3,
        durationMinutes: 15,
      },
      {
        title:
          'Quadratic Equations Test',

        instructions: [
          'Answer all questions.',
        ],

        durationMinutes: 15,

        totalMarks: 3,

        questions: [
          {
            type: 'SHORT_ANSWER',

            prompt:
              'Define a quadratic equation.',

            marks: 3,

            difficulty: 'MEDIUM',

            modelAnswer:
              'A polynomial equation of degree 2.',

            gradingInstructions:
              'Award marks for mentioning degree 2.',
          },
        ],
      },
    );

    const call =
      questionCreateMock.mock.calls[0][0];

    expect(
      call.data.type,
    ).toBe(
      QuestionType.TYPED,
    );

    expect(
      call.data.options,
    ).toBe(Prisma.DbNull);

    expect(
      call.data.correctOption,
    ).toBeNull();

    expect(
      call.data.modelAnswer,
    ).toBe(
      'A polynomial equation of degree 2.',
    );
  });

  it('uses paper totalMarks as maximumMarks', async () => {
    assessmentCreateMock.mockResolvedValue({
      id: 'assessment-db-id',
      assessmentId:
        'ASM-TEST-005',
    });

    questionCreateMock.mockResolvedValue({
      id: 'question-db-id',
    });

    await service.saveDraft(
      'teacher-user-id',
      {
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
        topic:
          'Quadratic Equations',

        kind:
          AssessmentKind.TEST,

        // Intentionally different.
        // Persistence should trust the
        // already validated paper.
        totalMarks: 100,

        durationMinutes: 30,
      },
      {
        title:
          'Quadratic Equations Test',

        instructions: [
          'Answer all questions.',
        ],

        durationMinutes: 30,

        totalMarks: 5,

        questions: [
          {
            type: 'LONG_ANSWER',

            prompt:
              'Explain how to solve a quadratic equation.',

            marks: 5,

            difficulty: 'HARD',

            modelAnswer:
              'Use factorisation, completing the square, or the quadratic formula.',

            gradingInstructions:
              'Award marks for correct explanation and method.',
          },
        ],
      },
    );

    const call =
      assessmentCreateMock.mock.calls[0][0];

    expect(
      call.data.maximumMarks,
    ).toBe(5);
  });

  it('does not create questions when assessment creation fails', async () => {
    assessmentCreateMock.mockRejectedValue(
      new Error(
        'Assessment creation failed',
      ),
    );

    await expect(
      service.saveDraft(
        'teacher-user-id',
        {
          board: 'CBSE',
          grade: '10',
          subject: 'Mathematics',
          topic:
            'Quadratic Equations',
          kind:
            AssessmentKind.TEST,
          totalMarks: 1,
          durationMinutes: 10,
        },
        {
          title:
            'Quadratic Equations Test',

          instructions: [
            'Answer all questions.',
          ],

          durationMinutes: 10,

          totalMarks: 1,

          questions: [
            {
              type: 'MCQ',

              prompt:
                'Which expression is quadratic?',

              marks: 1,

              difficulty: 'EASY',

              options: [
                {
                  id: 'A',
                  text:
                    'x² + 1',
                },
                {
                  id: 'B',
                  text:
                    'x + 1',
                },
              ],

              correctOption: 'A',

              explanation:
                'The highest power is 2.',
            },
          ],
        },
      ),
    ).rejects.toThrow(
      'Assessment creation failed',
    );

    expect(
      questionCreateMock,
    ).not.toHaveBeenCalled();
  });

  it('propagates question persistence failure from the transaction', async () => {
    assessmentCreateMock.mockResolvedValue({
      id: 'assessment-db-id',
      assessmentId:
        'ASM-TEST-006',
    });

    questionCreateMock.mockRejectedValue(
      new Error(
        'Question creation failed',
      ),
    );

    await expect(
      service.saveDraft(
        'teacher-user-id',
        {
          board: 'CBSE',
          grade: '10',
          subject: 'Mathematics',
          topic:
            'Quadratic Equations',
          kind:
            AssessmentKind.TEST,
          totalMarks: 1,
          durationMinutes: 10,
        },
        {
          title:
            'Quadratic Equations Test',

          instructions: [
            'Answer all questions.',
          ],

          durationMinutes: 10,

          totalMarks: 1,

          questions: [
            {
              type: 'MCQ',

              prompt:
                'Which expression is quadratic?',

              marks: 1,

              difficulty: 'EASY',

              options: [
                {
                  id: 'A',
                  text:
                    'x² + 1',
                },
                {
                  id: 'B',
                  text:
                    'x + 1',
                },
              ],

              correctOption: 'A',

              explanation:
                'The highest power is 2.',
            },
          ],
        },
      ),
    ).rejects.toThrow(
      'Question creation failed',
    );

    expect(
      transactionMock,
    ).toHaveBeenCalledTimes(1);
  });
});