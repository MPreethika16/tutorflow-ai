import { Test, TestingModule } from '@nestjs/testing';

import {
  QuestionType,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TeacherStyleRetriever } from './teacher-style-retriever.service';

describe('TeacherStyleRetriever', () => {
  let retriever: TeacherStyleRetriever;

  const questionFindManyMock = jest.fn();

  const prismaMock = {
    question: {
      findMany: questionFindManyMock,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          TeacherStyleRetriever,
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
        ],
      }).compile();

    retriever =
      module.get<TeacherStyleRetriever>(
        TeacherStyleRetriever,
      );
  });

  it('should be defined', () => {
    expect(retriever).toBeDefined();
  });

  it('retrieves questions using teacher and academic metadata', async () => {
    questionFindManyMock.mockResolvedValue([
      {
        type: QuestionType.MCQ,
        prompt:
          'Which expression is quadratic?',
        marks: 1,
        options: [
          {
            id: 'A',
            text: 'x + 1',
          },
          {
            id: 'B',
            text: 'x² + 1',
          },
        ],
      },
    ]);

    const result =
      await retriever.retrieve({
        teacherUserId:
          'teacher-user-id',
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
      });

    expect(
      questionFindManyMock,
    ).toHaveBeenCalledTimes(1);

    expect(
      questionFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assessment: {
            teacherId:
              'teacher-user-id',

            board: {
              equals: 'CBSE',
              mode: 'insensitive',
            },

            grade: {
              equals: '10',
              mode: 'insensitive',
            },

            subject: {
              equals:
                'Mathematics',
              mode: 'insensitive',
            },
          },
        },

        take: 5,
      }),
    );

    expect(result).toEqual([
      {
        type: QuestionType.MCQ,
        prompt:
          'Which expression is quadratic?',
        marks: 1,
        options: [
          {
            id: 'A',
            text: 'x + 1',
          },
          {
            id: 'B',
            text: 'x² + 1',
          },
        ],
      },
    ]);
  });

  it('uses five questions by default', async () => {
    questionFindManyMock.mockResolvedValue(
      [],
    );

    await retriever.retrieve({
      teacherUserId: 'teacher-1',
      board: 'CBSE',
      grade: '10',
      subject: 'Mathematics',
    });

    expect(
      questionFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
      }),
    );
  });

  it('respects a custom topK', async () => {
    questionFindManyMock.mockResolvedValue(
      [],
    );

    await retriever.retrieve({
      teacherUserId: 'teacher-1',
      board: 'CBSE',
      grade: '10',
      subject: 'Mathematics',
      topK: 3,
    });

    expect(
      questionFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
      }),
    );
  });

  it('caps topK at ten', async () => {
    questionFindManyMock.mockResolvedValue(
      [],
    );

    await retriever.retrieve({
      teacherUserId: 'teacher-1',
      board: 'CBSE',
      grade: '10',
      subject: 'Mathematics',
      topK: 100,
    });

    expect(
      questionFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      }),
    );
  });

  it('uses a minimum topK of one', async () => {
    questionFindManyMock.mockResolvedValue(
      [],
    );

    await retriever.retrieve({
      teacherUserId: 'teacher-1',
      board: 'CBSE',
      grade: '10',
      subject: 'Mathematics',
      topK: 0,
    });

    expect(
      questionFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
      }),
    );
  });

  it('trims academic metadata before querying', async () => {
    questionFindManyMock.mockResolvedValue(
      [],
    );

    await retriever.retrieve({
      teacherUserId: 'teacher-1',
      board: '  CBSE  ',
      grade: '  10  ',
      subject:
        '  Mathematics  ',
    });

    expect(
      questionFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assessment: {
            teacherId:
              'teacher-1',

            board: {
              equals: 'CBSE',
              mode: 'insensitive',
            },

            grade: {
              equals: '10',
              mode: 'insensitive',
            },

            subject: {
              equals:
                'Mathematics',
              mode: 'insensitive',
            },
          },
        },
      }),
    );
  });

  it('orders newer assessments first and preserves question order', async () => {
    questionFindManyMock.mockResolvedValue(
      [],
    );

    await retriever.retrieve({
      teacherUserId: 'teacher-1',
      board: 'CBSE',
      grade: '10',
      subject: 'Mathematics',
    });

    expect(
      questionFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          {
            assessment: {
              createdAt: 'desc',
            },
          },
          {
            order: 'asc',
          },
        ],
      }),
    );
  });

  it('returns an empty list when no teacher history matches', async () => {
    questionFindManyMock.mockResolvedValue(
      [],
    );

    const result =
      await retriever.retrieve({
        teacherUserId:
          'teacher-with-no-history',
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
      });

    expect(result).toEqual([]);
  });
});