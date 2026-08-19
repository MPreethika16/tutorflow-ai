import { Test, TestingModule } from '@nestjs/testing';

import {
  QuestionType,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TeacherStyleRetriever } from './teacher-style-retriever.service';
import { EmbeddingService } from '../embedding.service';

describe('TeacherStyleRetriever', () => {
  let retriever: TeacherStyleRetriever;

  const questionFindManyMock = jest.fn();
  const queryRawMock = jest.fn();
  const generateEmbeddingMock = jest.fn();

  const prismaMock = {
    question: {
      findMany: questionFindManyMock,
    },
    $queryRaw: queryRawMock,
  };

  const embeddingServiceMock = {
    generateEmbedding: generateEmbeddingMock,
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
          {
            provide: EmbeddingService,
            useValue: embeddingServiceMock,
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

  describe('metadata-only fallback (no topic)', () => {
    it('retrieves questions using teacher and academic metadata', async () => {
      questionFindManyMock.mockResolvedValue([
        {
          type: QuestionType.MCQ,
          prompt: 'Which expression is quadratic?',
          marks: 1,
          options: [{ id: 'A', text: 'x + 1' }, { id: 'B', text: 'x² + 1' }],
        },
      ]);

      const result = await retriever.retrieve({
        teacherUserId: 'teacher-user-id',
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
      });

      expect(questionFindManyMock).toHaveBeenCalledTimes(1);
      expect(queryRawMock).not.toHaveBeenCalled();
      expect(questionFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            assessment: {
              teacherId: 'teacher-user-id',
              board: { equals: 'CBSE', mode: 'insensitive' },
              grade: { equals: '10', mode: 'insensitive' },
              subject: { equals: 'Mathematics', mode: 'insensitive' },
            },
          },
          take: 5,
        }),
      );

      expect(result).toEqual([
        {
          type: QuestionType.MCQ,
          prompt: 'Which expression is quadratic?',
          marks: 1,
          options: [{ id: 'A', text: 'x + 1' }, { id: 'B', text: 'x² + 1' }],
        },
      ]);
    });

    it('uses five questions by default', async () => {
      questionFindManyMock.mockResolvedValue([]);
      await retriever.retrieve({
        teacherUserId: 'teacher-1',
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
      });
      expect(questionFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('respects a custom topK', async () => {
      questionFindManyMock.mockResolvedValue([]);
      await retriever.retrieve({
        teacherUserId: 'teacher-1',
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
        topK: 3,
      });
      expect(questionFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
    });

    it('caps topK at ten', async () => {
      questionFindManyMock.mockResolvedValue([]);
      await retriever.retrieve({
        teacherUserId: 'teacher-1',
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
        topK: 100,
      });
      expect(questionFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('uses a minimum topK of one', async () => {
      questionFindManyMock.mockResolvedValue([]);
      await retriever.retrieve({
        teacherUserId: 'teacher-1',
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
        topK: 0,
      });
      expect(questionFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });

    it('trims academic metadata before querying', async () => {
      questionFindManyMock.mockResolvedValue([]);
      await retriever.retrieve({
        teacherUserId: 'teacher-1',
        board: '  CBSE  ',
        grade: '  10  ',
        subject: '  Mathematics  ',
      });
      expect(questionFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            assessment: expect.objectContaining({
              board: { equals: 'CBSE', mode: 'insensitive' },
              grade: { equals: '10', mode: 'insensitive' },
              subject: { equals: 'Mathematics', mode: 'insensitive' },
            }),
          },
        }),
      );
    });

    it('orders newer assessments first and preserves question order', async () => {
      questionFindManyMock.mockResolvedValue([]);
      await retriever.retrieve({
        teacherUserId: 'teacher-1',
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
      });
      expect(questionFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { assessment: { createdAt: 'desc' } },
            { order: 'asc' },
          ],
        }),
      );
    });

    it('returns an empty list when no teacher history matches', async () => {
      questionFindManyMock.mockResolvedValue([]);
      const result = await retriever.retrieve({
        teacherUserId: 'teacher-with-no-history',
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
      });
      expect(result).toEqual([]);
    });
  });

  describe('hybrid query (with topic) and confidence threshold', () => {
    it('result below threshold is returned', async () => {
      generateEmbeddingMock.mockResolvedValue(new Array(1536).fill(0.1));
      queryRawMock.mockResolvedValue([{ type: QuestionType.MCQ, prompt: 'Below', marks: 1, distance: 0.5 }]);
      const result = await retriever.retrieve({ teacherUserId: '1', board: 'A', grade: '1', subject: 'A', topic: 'T' });
      expect(result).toHaveLength(1);
    });

    it('result exactly at threshold is accepted', async () => {
      generateEmbeddingMock.mockResolvedValue(new Array(1536).fill(0.1));
      queryRawMock.mockResolvedValue([{ type: QuestionType.MCQ, prompt: 'Exact', marks: 1, distance: 0.70 }]);
      const result = await retriever.retrieve({ teacherUserId: '1', board: 'A', grade: '1', subject: 'A', topic: 'T' });
      expect(result).toHaveLength(1);
    });

    it('result above threshold is excluded', async () => {
      generateEmbeddingMock.mockResolvedValue(new Array(1536).fill(0.1));
      queryRawMock.mockResolvedValue([{ type: QuestionType.MCQ, prompt: 'Above', marks: 1, distance: 0.71 }]);
      const result = await retriever.retrieve({ teacherUserId: '1', board: 'A', grade: '1', subject: 'A', topic: 'T' });
      expect(result).toHaveLength(0);
    });

    it('multiple results are filtered correctly', async () => {
      generateEmbeddingMock.mockResolvedValue(new Array(1536).fill(0.1));
      queryRawMock.mockResolvedValue([
        { type: QuestionType.MCQ, prompt: 'Below', marks: 1, distance: 0.5 },
        { type: QuestionType.MCQ, prompt: 'Above', marks: 1, distance: 0.8 },
        { type: QuestionType.MCQ, prompt: 'Exact', marks: 1, distance: 0.70 },
      ]);
      const result = await retriever.retrieve({ teacherUserId: '1', board: 'A', grade: '1', subject: 'A', topic: 'T' });
      expect(result).toHaveLength(2);
      expect(result.map(r => r.prompt)).toEqual(['Below', 'Exact']);
    });

    it('no qualifying result returns []', async () => {
      generateEmbeddingMock.mockResolvedValue(new Array(1536).fill(0.1));
      queryRawMock.mockResolvedValue([
        { type: QuestionType.MCQ, prompt: 'Above1', marks: 1, distance: 0.8 },
        { type: QuestionType.MCQ, prompt: 'Above2', marks: 1, distance: 0.9 },
      ]);
      const result = await retriever.retrieve({ teacherUserId: '1', board: 'A', grade: '1', subject: 'A', topic: 'T' });
      expect(result).toEqual([]);
    });

    it('propagates embedding provider failure', async () => {
      generateEmbeddingMock.mockRejectedValue(new Error('Embedding error'));
      await expect(retriever.retrieve({ teacherUserId: '1', board: 'A', grade: '1', subject: 'A', topic: 'T' })).rejects.toThrow('Embedding error');
    });

    it('caps topK properly in raw query and uses max distance', async () => {
      generateEmbeddingMock.mockResolvedValue(new Array(1536).fill(0.1));
      queryRawMock.mockResolvedValue([]);
      await retriever.retrieve({ teacherUserId: '1', board: 'A', grade: '1', subject: 'A', topic: 'T', topK: 100 });
      expect(JSON.stringify(queryRawMock.mock.calls)).toContain('LIMIT');
      expect(JSON.stringify(queryRawMock.mock.calls)).toContain('10');
      // verify the threshold is passed to the SQL (in case it is parameterized, though it might be in strings array)
      expect(JSON.stringify(queryRawMock.mock.calls)).toContain('0.7');
    });
  });
});