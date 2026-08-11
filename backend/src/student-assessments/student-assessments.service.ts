import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';

import {
  AssessmentAttemptStatus,
  AssessmentStatus,
  Prisma,
  QuestionType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

import { SaveStudentAnswerDto } from './dto/save-student-answer.dto';

type StudentAssessmentListItem = {
  assessmentId: string;
  title: string;
  description: string | null;
  board: string;
  grade: string;
  subject: string;
  durationMinutes: number | null;
  maximumMarks: number;
  instructions: string | null;
  startAt: Date | null;
  endAt: Date | null;
  attemptStatus: 'AVAILABLE' | 'IN_PROGRESS';
  attemptId: string | null;
  expiresAt: Date | null;
};

type AnswerData = {
  selectedOption: string | null;
  textAnswer: string | null;
  voiceUrl: string | null;
};

type McqOption = {
  id: string;
  text: string;
};

type AttemptDb = Pick<Prisma.TransactionClient, 'assessmentAttempt'>;

@Injectable()
export class StudentAssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAvailableForStudent(studentUserId: string) {
    const student = await this.prisma.student.findUnique({
      where: {
        userId: studentUserId,
      },
      select: {
        userId: true,
        board: true,
        grade: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const now = new Date();

    const assessments = await this.prisma.assessment.findMany({
      where: {
        status: AssessmentStatus.PUBLISHED,
        board: student.board,
        grade: student.grade,

        startAt: {
          not: null,
          lte: now,
        },

        endAt: {
          not: null,
          gt: now,
        },
      },

      orderBy: {
        createdAt: 'desc',
      },

      select: {
        assessmentId: true,
        title: true,
        description: true,
        board: true,
        grade: true,
        subject: true,
        durationMinutes: true,
        maximumMarks: true,
        instructions: true,
        startAt: true,
        endAt: true,

        attempts: {
          where: {
            studentUserId,
          },

          select: {
            attemptId: true,
            status: true,
            expiresAt: true,
          },

          take: 1,
        },
      },
    });

    const availableAssessments = assessments.flatMap<StudentAssessmentListItem>(
      (assessment) => {
        const attempt = assessment.attempts[0];

        if (!attempt) {
          return [
            {
              assessmentId: assessment.assessmentId,
              title: assessment.title,
              description: assessment.description,
              board: assessment.board,
              grade: assessment.grade,
              subject: assessment.subject,
              durationMinutes: assessment.durationMinutes,
              maximumMarks: assessment.maximumMarks,
              instructions: assessment.instructions,
              startAt: assessment.startAt,
              endAt: assessment.endAt,
              attemptStatus: 'AVAILABLE',
              attemptId: null,
              expiresAt: null,
            },
          ];
        }

        if (attempt.status === AssessmentAttemptStatus.SUBMITTED) {
          return [];
        }

        if (this.isAttemptExpired(attempt, now)) {
          return [];
        }

        return [
          {
            assessmentId: assessment.assessmentId,
            title: assessment.title,
            description: assessment.description,
            board: assessment.board,
            grade: assessment.grade,
            subject: assessment.subject,
            durationMinutes: assessment.durationMinutes,
            maximumMarks: assessment.maximumMarks,
            instructions: assessment.instructions,
            startAt: assessment.startAt,
            endAt: assessment.endAt,
            attemptStatus: 'IN_PROGRESS',
            attemptId: attempt.attemptId,
            expiresAt: attempt.expiresAt,
          },
        ];
      },
    );

    return {
      assessments: availableAssessments,
    };
  }

  async startAssessmentForStudent(studentUserId: string, assessmentId: string) {
    const student = await this.prisma.student.findUnique({
      where: {
        userId: studentUserId,
      },
      select: {
        userId: true,
        board: true,
        grade: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const now = new Date();

    const assessment = await this.prisma.assessment.findUnique({
      where: {
        assessmentId,
      },

      select: {
        id: true,
        assessmentId: true,
        title: true,
        board: true,
        grade: true,
        status: true,
        durationMinutes: true,
        maximumMarks: true,
        startAt: true,
        endAt: true,

        _count: {
          select: {
            questions: true,
          },
        },
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (
      assessment.board !== student.board ||
      assessment.grade !== student.grade
    ) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.status !== AssessmentStatus.PUBLISHED) {
      throw new ConflictException('Assessment is not available');
    }

    if (!assessment.startAt || !assessment.endAt) {
      throw new ConflictException('Assessment schedule is incomplete');
    }

    if (now < assessment.startAt) {
      throw new ConflictException('Assessment has not started yet');
    }

    if (now >= assessment.endAt) {
      throw new ConflictException('Assessment has expired');
    }

    if (assessment._count.questions === 0 || assessment.maximumMarks <= 0) {
      throw new ConflictException('Assessment is not ready to start');
    }

    const existingAttempt = await this.prisma.assessmentAttempt.findUnique({
      where: {
        studentUserId_assessmentId: {
          studentUserId,
          assessmentId: assessment.id,
        },
      },

      select: {
        id: true,
        attemptId: true,
        status: true,
        startedAt: true,
        expiresAt: true,
      },
    });

    if (existingAttempt) {
      return this.resolveExistingStartAttempt(
        existingAttempt,
        assessment,
        now,
      );
    }

    const startedAt = now;

    const expiresAt =
      assessment.durationMinutes == null
        ? assessment.endAt
        : new Date(
            Math.min(
              startedAt.getTime() + assessment.durationMinutes * 60 * 1000,
              assessment.endAt.getTime(),
            ),
          );

    const attemptId = this.generateAttemptId();

    try {
      const createdAttempt = await this.prisma.assessmentAttempt.create({
        data: {
          attemptId,
          studentUserId,
          assessmentId: assessment.id,
          status: AssessmentAttemptStatus.IN_PROGRESS,
          startedAt,
          expiresAt,
        },

        select: {
          attemptId: true,
          status: true,
          startedAt: true,
          expiresAt: true,
        },
      });

      return {
        created: true,
        data: this.buildStartResponse(createdAttempt, assessment),
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        this.isStudentAssessmentUniqueViolation(error)
      ) {
        const concurrentAttempt =
          await this.prisma.assessmentAttempt.findUnique({
            where: {
              studentUserId_assessmentId: {
                studentUserId,
                assessmentId: assessment.id,
              },
            },

            select: {
              id: true,
              attemptId: true,
              status: true,
              startedAt: true,
              expiresAt: true,
            },
          });

        if (concurrentAttempt) {
          return this.resolveExistingStartAttempt(
            concurrentAttempt,
            assessment,
            new Date(),
          );
        }
      }

      throw error;
    }
  }

  async getAttemptForStudent(studentUserId: string, attemptId: string) {
    const now = new Date();

    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: this.ownedAttemptWhere(
        studentUserId,
        attemptId,
      ),

      select: {
        id: true,
        attemptId: true,
        status: true,
        startedAt: true,
        expiresAt: true,
        submittedAt: true,

        assessment: {
          select: {
            assessmentId: true,
            title: true,
            subject: true,
            durationMinutes: true,
            maximumMarks: true,
            instructions: true,

            questions: {
              orderBy: {
                order: 'asc',
              },

              select: {
                id: true,
                questionId: true,
                type: true,
                prompt: true,
                marks: true,
                order: true,
                options: true,
              },
            },
          },
        },

        answers: {
          select: {
            questionId: true,
            selectedOption: true,
            textAnswer: true,
            voiceUrl: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Assessment attempt not found');
    }

    let effectiveStatus = attempt.status;

    let effectiveSubmittedAt = attempt.submittedAt;

    if (
      attempt.status === AssessmentAttemptStatus.IN_PROGRESS &&
      this.isAttemptExpired(attempt, now)
    ) {
      await this.submitExpiredAttempt(this.prisma, attempt, now);

      const refreshed = await this.prisma.assessmentAttempt.findUnique({
        where: {
          id: attempt.id,
        },

        select: {
          status: true,
          submittedAt: true,
        },
      });

      effectiveStatus = refreshed?.status ?? AssessmentAttemptStatus.SUBMITTED;

      effectiveSubmittedAt = refreshed?.submittedAt ?? attempt.expiresAt;
    }

    const answersByQuestionId = new Map(
      attempt.answers.map((answer) => [answer.questionId, answer]),
    );

    const questions = attempt.assessment.questions.map((question) => {
      const savedAnswer = answersByQuestionId.get(question.id);

      return {
        questionId: question.questionId,
        type: question.type,
        prompt: question.prompt,
        marks: question.marks,
        order: question.order,
        options:
          question.type === QuestionType.MCQ
            ? this.getStudentSafeMcqOptions(question.options)
            : null,

        answer: savedAnswer
          ? {
              selectedOption: savedAnswer.selectedOption,
              textAnswer: savedAnswer.textAnswer,
              voiceUrl: savedAnswer.voiceUrl,
              updatedAt: savedAnswer.updatedAt,
            }
          : null,
      };
    });

    return {
      attempt: {
        attemptId: attempt.attemptId,
        status: effectiveStatus,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        submittedAt: effectiveSubmittedAt,
      },

      assessment: {
        assessmentId: attempt.assessment.assessmentId,
        title: attempt.assessment.title,
        subject: attempt.assessment.subject,
        durationMinutes: attempt.assessment.durationMinutes,
        maximumMarks: attempt.assessment.maximumMarks,
        instructions: attempt.assessment.instructions,
      },

      questions,
    };
  }

  async saveAnswerForStudent(
    studentUserId: string,
    attemptId: string,
    questionId: string,
    dto: SaveStudentAnswerDto,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const attempt = await tx.assessmentAttempt.findFirst({
        where: this.ownedAttemptWhere(
          studentUserId,
          attemptId,
        ),

        select: {
          id: true,
          status: true,
          expiresAt: true,
          assessmentId: true,
        },
      });

      if (!attempt) {
        throw new NotFoundException('Assessment attempt not found');
      }

      if (attempt.status !== AssessmentAttemptStatus.IN_PROGRESS) {
        throw new ConflictException('Assessment attempt is not in progress');
      }

      if (this.isAttemptExpired(attempt, now)) {
        await this.submitExpiredAttempt(tx, attempt, now);

        return {
          kind: 'expired' as const,
        };
      }

      const question = await tx.question.findFirst({
        where: {
          questionId,
          assessmentId: attempt.assessmentId,
        },

        select: {
          id: true,
          questionId: true,
          type: true,
          options: true,
        },
      });

      if (!question) {
        throw new NotFoundException('Question not found');
      }

      const answerData = this.buildAnswerData(
        question.type,
        question.options,
        dto,
      );

      const answer = await tx.studentAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: attempt.id,
            questionId: question.id,
          },
        },

        create: {
          attemptId: attempt.id,
          questionId: question.id,
          ...answerData,
        },

        update: {
          ...answerData,
        },

        select: {
          selectedOption: true,
          textAnswer: true,
          voiceUrl: true,
          updatedAt: true,
        },
      });

      return {
        kind: 'saved' as const,
        data: {
          questionId: question.questionId,
          type: question.type,
          answer,
        },
      };
    });

    if (result.kind === 'expired') {
      throw new ConflictException('Assessment attempt has expired');
    }

    return result.data;
  }

  async submitAttemptForStudent(studentUserId: string, attemptId: string) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const attempt = await tx.assessmentAttempt.findFirst({
        where: this.ownedAttemptWhere(
          studentUserId,
          attemptId,
        ),

        select: {
          id: true,
          attemptId: true,
          status: true,
          startedAt: true,
          expiresAt: true,
          submittedAt: true,
          assessmentId: true,
        },
      });

      if (!attempt) {
        throw new NotFoundException('Assessment attempt not found');
      }

      if (attempt.status === AssessmentAttemptStatus.SUBMITTED) {
        throw new ConflictException('Assessment attempt already submitted');
      }

      const [totalQuestions, answeredQuestions] = await Promise.all([
        tx.question.count({
          where: {
            assessmentId: attempt.assessmentId,
          },
        }),

        tx.studentAnswer.count({
          where: {
            attemptId: attempt.id,
          },
        }),
      ]);

      // If the timer has already expired, make the
      // automatic submission authoritative at expiresAt.
      if (this.isAttemptExpired(attempt, now)) {
        await this.submitExpiredAttempt(tx, attempt, now);

        const submittedAttempt = await tx.assessmentAttempt.findUniqueOrThrow({
          where: {
            id: attempt.id,
          },

          select: {
            attemptId: true,
            status: true,
            startedAt: true,
            expiresAt: true,
            submittedAt: true,
          },
        });

        return {
          attempt: submittedAttempt,
          answeredQuestions,
          totalQuestions,
        };
      }

      // Concurrency-safe manual submission.
      // Only one request can change IN_PROGRESS -> SUBMITTED.
      const updateResult = await tx.assessmentAttempt.updateMany({
        where: {
          id: attempt.id,
          status: AssessmentAttemptStatus.IN_PROGRESS,
          expiresAt: {
            gt: now,
          },
        },

        data: {
          status: AssessmentAttemptStatus.SUBMITTED,
          submittedAt: now,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('Assessment attempt already submitted');
      }

      const submittedAttempt = await tx.assessmentAttempt.findUniqueOrThrow({
        where: {
          id: attempt.id,
        },

        select: {
          attemptId: true,
          status: true,
          startedAt: true,
          expiresAt: true,
          submittedAt: true,
        },
      });

      return {
        attempt: submittedAttempt,
        answeredQuestions,
        totalQuestions,
      };
    });
  }

  private buildAnswerData(
    questionType: QuestionType,
    options: Prisma.JsonValue | null,
    dto: SaveStudentAnswerDto,
  ): AnswerData {
    const hasSelectedOption = dto.selectedOption !== undefined;
    const hasTextAnswer = dto.textAnswer !== undefined;
    const hasVoiceUrl = dto.voiceUrl !== undefined;

    if (questionType === QuestionType.MCQ) {
      if (dto.selectedOption === undefined || hasTextAnswer || hasVoiceUrl) {
        throw new BadRequestException(
          'MCQ questions require only selectedOption',
        );
      }

      if (dto.selectedOption === null) {
        return {
          selectedOption: null,
          textAnswer: null,
          voiceUrl: null,
        };
      }

      const selectedOption = dto.selectedOption.trim().toUpperCase();

      if (!this.hasMcqOption(options, selectedOption)) {
        throw new BadRequestException('Selected option is invalid');
      }

      return {
        selectedOption,
        textAnswer: null,
        voiceUrl: null,
      };
    }

    if (questionType === QuestionType.TYPED) {
      if (!hasTextAnswer || hasSelectedOption || hasVoiceUrl) {
        throw new BadRequestException(
          'TYPED questions require only textAnswer',
        );
      }

      return {
        selectedOption: null,
        textAnswer: dto.textAnswer!,
        voiceUrl: null,
      };
    }

    if (questionType === QuestionType.VOICE) {
      if (!hasVoiceUrl || hasSelectedOption || hasTextAnswer) {
        throw new BadRequestException('VOICE questions require only voiceUrl');
      }

      return {
        selectedOption: null,
        textAnswer: null,
        voiceUrl: dto.voiceUrl!,
      };
    }

    throw new BadRequestException('Unsupported question type');
  }

  private hasMcqOption(
    options: Prisma.JsonValue | null,
    selectedOption: string,
  ): boolean {
    const parsedOptions = this.parseMcqOptions(options);

    const normalizedSelectedOption = selectedOption.trim().toUpperCase();

    return parsedOptions.some(
      (option) => option.id.trim().toUpperCase() === normalizedSelectedOption,
    );
  }

  private getStudentSafeMcqOptions(
    options: Prisma.JsonValue | null,
  ): McqOption[] {
    return this.parseMcqOptions(options).map((option) => ({
      id: option.id,
      text: option.text,
    }));
  }

  private parseMcqOptions(options: Prisma.JsonValue | null): McqOption[] {
    if (!Array.isArray(options)) {
      return [];
    }

    return options.flatMap((option): McqOption[] => {
      if (
        typeof option !== 'object' ||
        option === null ||
        Array.isArray(option)
      ) {
        return [];
      }

      const record = option as {
        id?: unknown;
        text?: unknown;
      };

      if (typeof record.id !== 'string' || typeof record.text !== 'string') {
        return [];
      }

      return [
        {
          id: record.id,
          text: record.text,
        },
      ];
    });
  }

  private ownedAttemptWhere(
    studentUserId: string,
    attemptId: string,
  ) {
    return {
      attemptId,
      studentUserId,
    };
  }

  private isAttemptExpired(
    attempt: {
      expiresAt: Date;
    },
    now: Date,
  ): boolean {
    return attempt.expiresAt <= now;
  }

  private async resolveExistingStartAttempt(
    attempt: {
      id: string;
      attemptId: string;
      status: AssessmentAttemptStatus;
      startedAt: Date;
      expiresAt: Date;
    },
    assessment: {
      assessmentId: string;
      title: string;
      durationMinutes: number | null;
      maximumMarks: number;
    },
    now: Date,
  ) {
    if (attempt.status === AssessmentAttemptStatus.SUBMITTED) {
      throw new ConflictException('Assessment already attempted');
    }

    if (this.isAttemptExpired(attempt, now)) {
      await this.submitExpiredAttempt(
        this.prisma,
        attempt,
        now,
      );

      throw new ConflictException('Assessment already attempted');
    }

    return {
      created: false,
      data: this.buildStartResponse(
        attempt,
        assessment,
      ),
    };
  }

  private async submitExpiredAttempt(
    db: AttemptDb,
    attempt: {
      id: string;
      status: AssessmentAttemptStatus;
      expiresAt: Date;
    },
    now: Date,
  ): Promise<boolean> {
    if (
      attempt.status !== AssessmentAttemptStatus.IN_PROGRESS ||
      !this.isAttemptExpired(attempt, now)
    ) {
      return false;
    }

    const result = await db.assessmentAttempt.updateMany({
      where: {
        id: attempt.id,
        status: AssessmentAttemptStatus.IN_PROGRESS,
        expiresAt: {
          lte: now,
        },
      },

      data: {
        status: AssessmentAttemptStatus.SUBMITTED,
        submittedAt: attempt.expiresAt,
      },
    });

    return result.count > 0;
  }

  private buildStartResponse(
    attempt: {
      attemptId: string;
      status: AssessmentAttemptStatus;
      startedAt: Date;
      expiresAt: Date;
    },
    assessment: {
      assessmentId: string;
      title: string;
      durationMinutes: number | null;
      maximumMarks: number;
    },
  ) {
    return {
      attempt,
      assessment: {
        assessmentId: assessment.assessmentId,
        title: assessment.title,
        durationMinutes: assessment.durationMinutes,
        maximumMarks: assessment.maximumMarks,
      },
    };
  }

  private isStudentAssessmentUniqueViolation(
    error: Prisma.PrismaClientKnownRequestError,
  ): boolean {
    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return (
        target.includes('studentUserId') && target.includes('assessmentId')
      );
    }

    const meta = error.meta as
      | {
          driverAdapterError?: {
            cause?: {
              constraint?: {
                fields?: unknown;
              };
            };
          };
        }
      | undefined;

    const fields = meta?.driverAdapterError?.cause?.constraint?.fields;

    if (!Array.isArray(fields)) {
      return false;
    }

    return fields.includes('studentUserId') && fields.includes('assessmentId');
  }

  private generateAttemptId(): string {
    const suffix = randomBytes(8).toString('hex').toUpperCase();

    return `ATT-${suffix}`;
  }
}