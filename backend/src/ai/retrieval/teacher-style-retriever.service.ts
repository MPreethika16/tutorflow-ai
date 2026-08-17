import { Injectable } from '@nestjs/common';

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
  topK?: number;
};

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 10;

@Injectable()
export class TeacherStyleRetriever {
  constructor(
    private readonly prisma: PrismaService,
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