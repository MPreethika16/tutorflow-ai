import { Injectable } from '@nestjs/common';

import {
  AssessmentKind,
  AssessmentStatus,
  ContentSource,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { GeneratedPaper } from './contracts/generated-paper.schema';
import type { GeneratePaperDto } from './dto/generate-paper.dto';
import { mapGeneratedQuestion } from './mappers/generated-question.mapper';
import { generateAssessmentId } from '../assessments/utils/assessment.util';

@Injectable()
export class GeneratedPaperPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async saveDraft(
    teacherUserId: string,
    dto: GeneratePaperDto,
    paper: GeneratedPaper,
  ) {
    const assessmentId =
      generateAssessmentId();

    return this.prisma.$transaction(
      async (tx) => {
        const assessment =
          await tx.assessment.create({
            data: {
              assessmentId,

              teacherId:
                teacherUserId,

              title:
                paper.title.trim(),

              description: null,

              board:
                dto.board.trim(),

              grade:
                dto.grade.trim(),

              subject:
                dto.subject.trim(),

              kind:
                dto.kind ??
                AssessmentKind.PRACTICE,

              source:
                ContentSource.AI_GENERATED,

              durationMinutes:
                paper.durationMinutes,

              instructions:
                paper.instructions.join(
                  '\n',
                ),

              maximumMarks:
                paper.totalMarks,

              startAt: null,
              endAt: null,

              status:
                AssessmentStatus.DRAFT,
            },

            select: {
              id: true,
              assessmentId: true,
              title: true,
              board: true,
              grade: true,
              subject: true,
              kind: true,
              source: true,
              durationMinutes: true,
              instructions: true,
              maximumMarks: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          });

        for (
          const [
            index,
            generatedQuestion,
          ] of paper.questions.entries()
        ) {
          const mapped =
            mapGeneratedQuestion(
              generatedQuestion,
            );

          await tx.question.create({
            data: {
              questionId:
                `${assessmentId}-Q${index + 1}`,

              assessmentId:
                assessment.id,

              type:
                mapped.type,

              prompt:
                mapped.prompt,

              marks:
                mapped.marks,

              order:
                index + 1,

              options:
                    mapped.options === null
                        ? Prisma.DbNull
                        : mapped.options,

              correctOption:
                mapped.correctOption,

              explanation:
                mapped.explanation,

              modelAnswer:
                mapped.modelAnswer,

              gradingInstructions:
                mapped.gradingInstructions,
            },
          });
        }

        return assessment;
      },
    );
  }
}