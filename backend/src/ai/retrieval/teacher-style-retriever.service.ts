import { Injectable } from '@nestjs/common';
import { EmbeddingService } from '../embedding.service';

import {
  QuestionType,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type TeacherStyleExample = {
  type: QuestionType;
  prompt: string;
  marks: number;
  options: unknown | null;
};

export type RetrieveTeacherStyleInput = {
  teacherUserId: string;
  board: string;
  grade: string;
  subject: string;
  topic?: string;
  topK?: number;
};

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 10;

/**
 * Provisional hybrid retrieval confidence gate.
 * Derived from Phase 7.8.1 evaluation experiment.
 * Should be recalibrated when the dataset grows.
 */
export const TEACHER_STYLE_MAX_COSINE_DISTANCE = 0.70;

@Injectable()
export class TeacherStyleRetriever {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async retrieve(
    input: RetrieveTeacherStyleInput,
  ): Promise<TeacherStyleExample[]> {
    const topK = Math.min(
      Math.max(
        input.topK ?? DEFAULT_TOP_K,
        1,
      ),
      MAX_TOP_K,
    );

    if (input.topic) {
      const queryText = `${input.subject} ${input.topic}`;
      const embedding = await this.embeddingService.generateEmbedding(queryText);
      const embeddingString = `[${embedding.join(',')}]`;

      const results = await this.prisma.$queryRaw<any[]>`
        SELECT 
          q.type, 
          q.prompt, 
          q.marks, 
          q.options,
          q.embedding <=> ${embeddingString}::vector AS distance
        FROM "Question" q
        INNER JOIN "Assessment" a ON q."assessmentId" = a.id
        WHERE q.embedding IS NOT NULL
          AND a."teacherId" = ${input.teacherUserId}::uuid
          AND a.board ILIKE ${input.board.trim()}
          AND a.grade ILIKE ${input.grade.trim()}
          AND a.subject ILIKE ${input.subject.trim()}
          AND (q.embedding <=> ${embeddingString}::vector) <= ${TEACHER_STYLE_MAX_COSINE_DISTANCE}
        ORDER BY distance ASC
        LIMIT ${topK}
      `;

      return results
        .filter((row) => row.distance <= TEACHER_STYLE_MAX_COSINE_DISTANCE)
        .map((row) => ({
          type: row.type as QuestionType,
          prompt: row.prompt,
          marks: row.marks,
          options: row.options,
        }));
    }

    const questions =
      await this.prisma.question.findMany({
        where: {
          assessment: {
            teacherId:
              input.teacherUserId,

            board: {
              equals:
                input.board.trim(),
              mode: 'insensitive',
            },

            grade: {
              equals:
                input.grade.trim(),
              mode: 'insensitive',
            },

            subject: {
              equals:
                input.subject.trim(),
              mode: 'insensitive',
            },
          },
        },

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

        take: topK,

        select: {
          type: true,
          prompt: true,
          marks: true,
          options: true,
        },
      });

    return questions.map(
      (question) => ({
        type: question.type,
        prompt: question.prompt,
        marks: question.marks,
        options: question.options,
      }),
    );
  }
}