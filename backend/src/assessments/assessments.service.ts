import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AssessmentKind,
  AssessmentStatus,
  AssessmentAttemptStatus,
  ContentSource,
  EvaluationStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { generateAssessmentId } from './utils/assessment.util';
import { ListAssessmentsDto } from './dto/list-assessments.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssessmentResultPublishedEvent } from '../notifications/events/assessment-result-published.event';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a draft assessment owned by the
   * authenticated teacher.
   */
  async create(
    teacherUserId: string,
    dto: CreateAssessmentDto,
  ) {
    // Step 1:
    // Confirm that the authenticated user has a Teacher profile.
    //
    // The role guard already checks that the JWT role is TEACHER,
    // but this database check confirms that a related Teacher row exists.
    const teacher = await this.prisma.teacher.findUnique({
      where: {
        userId: teacherUserId,
      },
      select: {
        userId: true,
      },
    });

    if (!teacher) {
      throw new NotFoundException(
        'Teacher profile was not found',
      );
    }

    // Step 2:
    // startAt and endAt must be provided together.
    //
    // Valid:
    // - both missing
    // - both provided
    //
    // Invalid:
    // - only startAt
    // - only endAt
    const onlyOneScheduleValueProvided =
      Boolean(dto.startAt) !== Boolean(dto.endAt);

    if (onlyOneScheduleValueProvided) {
      throw new BadRequestException(
        'startAt and endAt must be provided together',
      );
    }

    // Step 3:
    // Convert ISO date strings into JavaScript Date objects.
    //
    // If the schedule was not provided, keep both values undefined.
    const startAt = dto.startAt
      ? new Date(dto.startAt)
      : undefined;

    const endAt = dto.endAt
      ? new Date(dto.endAt)
      : undefined;

    // Step 4:
    // When both dates exist, endAt must be later than startAt.
    if (
      startAt &&
      endAt &&
      endAt.getTime() <= startAt.getTime()
    ) {
      throw new BadRequestException(
        'endAt must be later than startAt',
      );
    }

    // Step 5:
    // Create the assessment.
    //
    // The backend controls:
    // - teacherId
    // - status
    // - maximumMarks
    //
    // The frontend cannot override these values.
    const assessmentId = generateAssessmentId();
return this.prisma.assessment.create({
  data: {
  assessmentId,
  teacherId: teacherUserId,

  title: dto.title.trim(),
  description:
    dto.description === undefined
      ? null
      : dto.description.trim(),

  board: dto.board.trim(),
  grade: dto.grade.trim(),
  subject: dto.subject.trim(),

  kind:
    dto.kind ??
    AssessmentKind.PRACTICE,

  source:
    ContentSource.MANUAL,

  durationMinutes:
    dto.durationMinutes ?? null,

  instructions:
    dto.instructions === undefined
      ? null
      : dto.instructions.trim(),

  startAt: startAt ?? null,
  endAt: endAt ?? null,

  status:
    AssessmentStatus.DRAFT,

  maximumMarks: 0,
},
  select: {
    id: true,
    assessmentId: true,
    title: true,
    description: true,
    board: true,
    grade: true,
    subject: true,
    kind: true,
source: true,
    durationMinutes: true,
    instructions: true,
    maximumMarks: true,
    startAt: true,
    endAt: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  },
});
  }


  async findOneForTeacher(
  teacherUserId: string,
  assessmentId: string,
) {
  // Search using both:
  // 1. Public assessment ID from the URL
  // 2. Logged-in teacher ID from the JWT
  //
  // This prevents one teacher from viewing another teacher's assessment.
  const assessment = await this.prisma.assessment.findFirst({
    where: {
      assessmentId,
      teacherId: teacherUserId,
    },
    select: {
      id: true,
      assessmentId: true,
      title: true,
      description: true,
      board: true,
      grade: true,
      subject: true,
      kind: true,
source: true,
      durationMinutes: true,
      instructions: true,
      maximumMarks: true,
      startAt: true,
      endAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // We return the same 404 response when:
  // - the assessment does not exist
  // - the assessment belongs to another teacher
  //
  // This avoids exposing another teacher's data.
  if (!assessment) {
    throw new NotFoundException('Assessment not found');
  }

  return assessment;
}

    async findAllForTeacher(
  teacherUserId: string,
  query: ListAssessmentsDto,
) {
  const {
    search,
    status,
    board,
    grade,
    subject,
    page = 1,
    limit = 10,
  } = query;

  // Remove extra spaces from optional text filters.
  const normalizedSearch = search?.trim();
  const normalizedBoard = board?.trim();
  const normalizedGrade = grade?.trim();
  const normalizedSubject = subject?.trim();

  // Offset pagination:
  // page 1 -> skip 0
  // page 2 -> skip limit
  const skip = (page - 1) * limit;

  // Build one reusable filter for both listing and counting.
  const where: Prisma.AssessmentWhereInput = {
    // Security rule:
    // always return only this teacher's assessments.
    teacherId: teacherUserId,

    // Exact enum filter when provided.
    status,

    // Case-insensitive academic filters.
    board: normalizedBoard
      ? {
          equals: normalizedBoard,
          mode: 'insensitive',
        }
      : undefined,

    grade: normalizedGrade
      ? {
          equals: normalizedGrade,
          mode: 'insensitive',
        }
      : undefined,

    subject: normalizedSubject
      ? {
          equals: normalizedSubject,
          mode: 'insensitive',
        }
      : undefined,

    // Flexible partial search across useful fields.
    OR: normalizedSearch
      ? [
          {
            assessmentId: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
          {
            title: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
        ]
      : undefined,
  };

  // Fetch the requested page and count all matching rows together.
  const [assessments, total] =
    await this.prisma.$transaction([
      this.prisma.assessment.findMany({
        where,
        skip,
        take: limit,
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
          kind: true,
source: true,
          durationMinutes: true,
          maximumMarks: true,
          startAt: true,
          endAt: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      this.prisma.assessment.count({
        where,
      }),
    ]);

  return {
    data: assessments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
    async updateForTeacher(
  teacherUserId: string,
  assessmentId: string,
  dto: UpdateAssessmentDto,
) {
  // Step 1:
  // Find the assessment using both the public assessment ID
  // and the logged-in teacher ID.
  //
  // This is the ownership check.
  const assessment =
    await this.prisma.assessment.findFirst({
      where: {
        assessmentId,
        teacherId: teacherUserId,
      },
      select: {
        id: true,
        status: true,
        startAt: true,
        endAt: true,
      },
    });

  // Covers:
  // - assessment does not exist
  // - assessment belongs to another teacher
  if (!assessment) {
    throw new NotFoundException('Assessment not found');
  }

  // Step 2:
  // Only draft assessments are editable.
  //
  // Published, closed, and archived assessments are
  // treated as historical records.
  if (assessment.status !== AssessmentStatus.DRAFT) {
    throw new ConflictException(
      'Only draft assessments can be updated',
    );
  }

  // Step 3:
  // Detect whether the client sent schedule fields.
  const startAtWasProvided = dto.startAt !== undefined;
  const endAtWasProvided = dto.endAt !== undefined;

  // The schedule must be updated as a pair.
  if (startAtWasProvided !== endAtWasProvided) {
    throw new BadRequestException(
      'startAt and endAt must be provided together',
    );
  }

  // Step 4:
  // Convert date strings only when both schedule fields
  // were included in the request.
  const newStartAt =
    startAtWasProvided && dto.startAt
      ? new Date(dto.startAt)
      : undefined;

  const newEndAt =
    endAtWasProvided && dto.endAt
      ? new Date(dto.endAt)
      : undefined;

  // When a new schedule is provided,
  // the end must be later than the start.
  if (
    newStartAt &&
    newEndAt &&
    newEndAt.getTime() <= newStartAt.getTime()
  ) {
    throw new BadRequestException(
      'endAt must be later than startAt',
    );
  }

  // Step 5:
  // Update only the fields supplied by the client.
  //
  // Prisma ignores undefined values, so omitted fields
  // remain unchanged.
  return this.prisma.assessment.update({
    where: {
      id: assessment.id,
    },
    data: {
      title:
        dto.title === undefined
          ? undefined
          : dto.title.trim(),

      description:
        dto.description === undefined
          ? undefined
          : dto.description.trim(),

      board:
        dto.board === undefined
          ? undefined
          : dto.board.trim(),

      grade:
        dto.grade === undefined
          ? undefined
          : dto.grade.trim(),

      subject:
        dto.subject === undefined
          ? undefined
          : dto.subject.trim(),
      
      kind: dto.kind,

      durationMinutes: dto.durationMinutes,

      instructions:
        dto.instructions === undefined
          ? undefined
          : dto.instructions.trim(),

      startAt: newStartAt,
      endAt: newEndAt,
    },
    select: {
      assessmentId: true,
      title: true,
      description: true,
      board: true,
      grade: true,
      subject: true,
      kind: true,
      source: true,
      durationMinutes: true,
      instructions: true,
      maximumMarks: true,
      startAt: true,
      endAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async publishForTeacher(
  teacherUserId: string,
  assessmentId: string,
) {
  // --------------------------------------------------
  // Step 1:
  // Find the assessment that belongs to the logged-in
  // teacher.
  //
  // We search using BOTH:
  // - Public assessment ID
  // - Teacher ID from JWT
  //
  // This prevents one teacher from publishing another
  // teacher's assessment.
  // --------------------------------------------------
  const assessment =
    await this.prisma.assessment.findFirst({
      where: {
        assessmentId,
        teacherId: teacherUserId,
      },
    });

  // --------------------------------------------------
  // Step 2:
  // Assessment not found.
  //
  // Covers two cases:
  // 1. Assessment doesn't exist.
  // 2. Assessment belongs to another teacher.
  // --------------------------------------------------
  if (!assessment) {
    throw new NotFoundException(
      'Assessment not found',
    );
  }

  // --------------------------------------------------
  // Step 3:
  // Only draft assessments can be published.
  //
  // Already published assessments should not be
  // published again.
  // --------------------------------------------------
  if (
    assessment.status !==
    AssessmentStatus.DRAFT
  ) {
    throw new ConflictException(
      'Only draft assessments can be published',
    );
  }

  // --------------------------------------------------
  // Step 4:
  // Duration is mandatory before publishing.
  //
  // Students cannot attempt an assessment without
  // knowing how much time they have.
  // --------------------------------------------------
  if (
    !assessment.durationMinutes ||
    assessment.durationMinutes <= 0
  ) {
    throw new BadRequestException(
      'Assessment duration is required',
    );
  }

  // --------------------------------------------------
  // Step 5:
  // Both start and end times must exist.
  //
  // The schedule determines when students are allowed
  // to access the assessment.
  // --------------------------------------------------
  if (
    !assessment.startAt ||
    !assessment.endAt
  ) {
    throw new BadRequestException(
      'Assessment schedule is required',
    );
  }

  // --------------------------------------------------
  // Step 6:
  // End time must be later than start time.
  //
  // Prevent invalid schedules.
  // --------------------------------------------------
  if (
    assessment.endAt <= assessment.startAt
  ) {
    throw new BadRequestException(
      'End time must be later than start time',
    );
  }

  // --------------------------------------------------
  // Step 7:
  // Everything is valid.
  //
  // Publish the assessment by changing only
  // the status.
  // --------------------------------------------------
  return this.prisma.assessment.update({
    where: {
      id: assessment.id,
    },
    data: {
      status:
        AssessmentStatus.PUBLISHED,
    },
    select: {
      assessmentId: true,
      title: true,
      description: true,
      board: true,
      grade: true,
      subject: true,
      kind: true,
      source: true,
      durationMinutes: true,
      instructions: true,
      maximumMarks: true,
      startAt: true,
      endAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

  async closeForTeacher(
  teacherUserId: string,
  assessmentId: string,
) {
  // Step 1:
  // Find the assessment owned by the logged-in teacher.
  const assessment =
    await this.prisma.assessment.findFirst({
      where: {
        assessmentId,
        teacherId: teacherUserId,
      },
      select: {
        id: true,
        status: true,
      },
    });

  // Step 2:
  // Return 404 when the assessment does not exist
  // or belongs to another teacher.
  if (!assessment) {
    throw new NotFoundException(
      'Assessment not found',
    );
  }

  // Step 3:
  // Only published assessments can be closed.
  if (
    assessment.status !==
    AssessmentStatus.PUBLISHED
  ) {
    throw new ConflictException(
      'Only published assessments can be closed',
    );
  }

  // Step 4:
  // Change the workflow state:
  // PUBLISHED -> CLOSED
  return this.prisma.assessment.update({
    where: {
      id: assessment.id,
    },
    data: {
      status: AssessmentStatus.CLOSED,
    },
    select: {
      assessmentId: true,
      title: true,
      description: true,
      board: true,
      grade: true,
      subject: true,
      kind: true,
source: true,
      durationMinutes: true,
      instructions: true,
      maximumMarks: true,
      startAt: true,
      endAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async archiveForTeacher(
  teacherUserId: string,
  assessmentId: string,
) {
  // Step 1:
  // Find an assessment owned by the logged-in teacher.
  //
  // Using assessmentId + teacherId prevents one teacher
  // from archiving another teacher's assessment.
  const assessment =
    await this.prisma.assessment.findFirst({
      where: {
        assessmentId,
        teacherId: teacherUserId,
      },
      select: {
        id: true,
        status: true,
      },
    });

  // Step 2:
  // Return 404 for both cases:
  // - the assessment does not exist
  // - the assessment belongs to another teacher
  if (!assessment) {
    throw new NotFoundException(
      'Assessment not found',
    );
  }

  // Step 3:
  // Only CLOSED assessments can be archived.
  //
  // Valid transition:
  // CLOSED -> ARCHIVED
  if (
    assessment.status !==
    AssessmentStatus.CLOSED
  ) {
    throw new ConflictException(
      'Only closed assessments can be archived',
    );
  }

  // Step 4:
  // Update only the workflow status.
  //
  // The assessment remains in the database as
  // read-only historical data.
  return this.prisma.assessment.update({
    where: {
      id: assessment.id,
    },
    data: {
      status: AssessmentStatus.ARCHIVED,
    },
    select: {
      assessmentId: true,
      title: true,
      description: true,
      board: true,
      grade: true,
      subject: true,
      kind: true,
source: true,
      durationMinutes: true,
      instructions: true,
      maximumMarks: true,
      startAt: true,
      endAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async getStatisticsForTeacher(
  teacherUserId: string,
) {
  // All statistics are restricted to the
  // logged-in teacher.

  const [
    totalAssessments,
    draftAssessments,
    publishedAssessments,
    closedAssessments,
    archivedAssessments,
  ] = await this.prisma.$transaction([
    // Total assessments
    this.prisma.assessment.count({
      where: {
        teacherId: teacherUserId,
      },
    }),

    // Draft
    this.prisma.assessment.count({
      where: {
        teacherId: teacherUserId,
        status: AssessmentStatus.DRAFT,
      },
    }),

    // Published
    this.prisma.assessment.count({
      where: {
        teacherId: teacherUserId,
        status: AssessmentStatus.PUBLISHED,
      },
    }),

    // Closed
    this.prisma.assessment.count({
      where: {
        teacherId: teacherUserId,
        status: AssessmentStatus.CLOSED,
      },
    }),

    // Archived
    this.prisma.assessment.count({
      where: {
        teacherId: teacherUserId,
        status: AssessmentStatus.ARCHIVED,
      },
    }),
  ]);

  return {
    totalAssessments,
    draftAssessments,
    publishedAssessments,
    closedAssessments,
    archivedAssessments,
  };
}

  async getAttemptForReview(
    teacherUserId: string,
    assessmentId: string,
    attemptId: string,
  ) {
    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: {
        attemptId,
        assessment: {
          assessmentId,
          teacherId: teacherUserId,
        },
      },
      select: {
        attemptId: true,
        status: true,
        submittedAt: true,
        answers: {
          select: {
            id: true,
            selectedOption: true,
            textAnswer: true,
            voiceUrl: true,
            question: {
              select: {
                id: true,
                prompt: true,
                type: true,
                marks: true,
                modelAnswer: true,
                gradingInstructions: true,
              },
            },
            evaluation: {
              select: {
                aiMarks: true,
                aiFeedback: true,
                aiReasoning: true,
                aiConfidence: true,
                teacherMarks: true,
                teacherFeedback: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Assessment attempt not found');
    }

    const totalAnswers = attempt.answers.length;
    let approvedAnswers = 0;
    let waitingForReviewAnswers = 0;
    let failedEvaluations = 0;
    let reviewableCount = 0;

    let totalMaximumMarks = 0;
    let totalApprovedMarks = 0;

    const answers = attempt.answers.map((answer) => {
      totalMaximumMarks += answer.question.marks ?? 0;
      
      let finalMarks: number | null = null;

      if (answer.evaluation) {
        reviewableCount++;
        
        finalMarks = answer.evaluation.teacherMarks ?? answer.evaluation.aiMarks;

        if (answer.evaluation.status === EvaluationStatus.APPROVED) {
          approvedAnswers++;
          totalApprovedMarks += finalMarks ?? 0;
        } else if (
          answer.evaluation.status === EvaluationStatus.WAITING_FOR_REVIEW
        ) {
          waitingForReviewAnswers++;
        } else if (answer.evaluation.status === EvaluationStatus.FAILED) {
          failedEvaluations++;
        }
      }

      return {
        id: answer.id,
        selectedOption: answer.selectedOption,
        textAnswer: answer.textAnswer,
        voiceUrl: answer.voiceUrl,
        question: answer.question,
        evaluation: answer.evaluation,
        finalMarks,
      };
    });

    const reviewComplete =
      reviewableCount > 0
        ? approvedAnswers === reviewableCount
        : false;

    return {
      attempt: {
        attemptId: attempt.attemptId,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
      },
      answers,
      summary: {
        totalAnswers,
        approvedAnswers,
        waitingForReviewAnswers,
        failedEvaluations,
        totalMaximumMarks,
        totalApprovedMarks,
        reviewComplete,
      },
    };
  }

  async reviewAnswer(
    teacherUserId: string,
    assessmentId: string,
    attemptId: string,
    answerId: string,
    dto: { teacherMarks?: number; teacherFeedback?: string },
  ) {
    const answer = await this.prisma.studentAnswer.findFirst({
      where: {
        id: answerId,
        attempt: {
          attemptId,
          assessment: {
            assessmentId,
            teacherId: teacherUserId,
          },
        },
      },
      include: {
        question: true,
        evaluation: true,
      },
    });

    if (!answer) {
      throw new NotFoundException('Answer not found');
    }

    if (
      !answer.evaluation ||
      answer.evaluation.status !== EvaluationStatus.WAITING_FOR_REVIEW
    ) {
      throw new ConflictException(
        'Answer evaluation is not in WAITING_FOR_REVIEW status',
      );
    }

    let finalTeacherMarks: number | null | undefined = undefined;
    let finalTeacherFeedback: string | null | undefined = undefined;

    if (dto.teacherMarks !== undefined && dto.teacherMarks !== null) {
      if (dto.teacherMarks < 0 || dto.teacherMarks > answer.question.marks) {
        throw new BadRequestException(
          'Teacher marks must be between 0 and maximum question marks',
        );
      }
      finalTeacherMarks = dto.teacherMarks;
    } else if (dto.teacherMarks === null) {
      finalTeacherMarks = null;
    }

    if (dto.teacherFeedback !== undefined && dto.teacherFeedback !== null) {
      const trimmed = dto.teacherFeedback.trim();
      if (trimmed === '') {
        throw new BadRequestException(
          'Teacher feedback cannot be whitespace only',
        );
      }
      finalTeacherFeedback = trimmed;
    } else if (dto.teacherFeedback === null) {
      finalTeacherFeedback = null;
    }

    const updatedEvaluation = await this.prisma.answerEvaluation.update({
      where: { id: answer.evaluation.id },
      data: {
        teacherMarks: finalTeacherMarks,
        teacherFeedback: finalTeacherFeedback,
        status: EvaluationStatus.APPROVED,
      },
      select: {
        aiMarks: true,
        aiFeedback: true,
        aiConfidence: true,
        teacherMarks: true,
        teacherFeedback: true,
        status: true,
      },
    });

    return {
      aiMarks: updatedEvaluation.aiMarks,
      aiFeedback: updatedEvaluation.aiFeedback,
      aiConfidence: updatedEvaluation.aiConfidence,
      teacherMarks: updatedEvaluation.teacherMarks,
      teacherFeedback: updatedEvaluation.teacherFeedback,
      status: updatedEvaluation.status,
      finalMarks:
        updatedEvaluation.teacherMarks ?? updatedEvaluation.aiMarks,
    };
  }

  async publishAttemptResult(
    teacherUserId: string,
    assessmentId: string,
    attemptId: string,
  ) {
    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: {
        attemptId,
        assessment: {
          assessmentId,
          teacherId: teacherUserId,
        },
      },
      include: {
        assessment: {
          include: {
            questions: true,
          },
        },
        answers: {
          include: {
            evaluation: true,
          },
        },
        student: {
          select: { userId: true },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Assessment attempt not found');
    }

    if (attempt.status !== AssessmentAttemptStatus.SUBMITTED) {
      throw new ConflictException('Cannot publish result: Attempt is not submitted');
    }

    // Check if grading is complete
    for (const answer of attempt.answers) {
      if (!answer.evaluation || answer.evaluation.status !== EvaluationStatus.APPROVED) {
        throw new ConflictException('Cannot publish result: Grading is incomplete or evaluations are pending/failed');
      }
    }

    if (attempt.publishedAt) {
      return {
        attemptId: attempt.attemptId,
        finalMarks: attempt.finalMarks ?? 0,
        maximumMarks: attempt.maximumMarks ?? 0,
        publishedAt: attempt.publishedAt,
      };
    }

    let maximumMarks = 0;
    let finalMarks = 0;

    // sum marks of all questions in the assessment
    for (const question of attempt.assessment.questions) {
      maximumMarks += question.marks;
    }

    // sum marks of all approved answers
    for (const answer of attempt.answers) {
      const mark = answer.evaluation!.teacherMarks ?? answer.evaluation!.aiMarks ?? 0;
      finalMarks += mark;
    }

    const publishedAt = new Date();

    await this.prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        finalMarks,
        maximumMarks,
        publishedAt,
      },
    });

    this.eventEmitter.emit(
      'assessment.result_published',
      new AssessmentResultPublishedEvent(
        attempt.attemptId,
        attempt.student.userId,
        attempt.assessment.title
      )
    );

    return {
      attemptId: attempt.attemptId,
      finalMarks,
      maximumMarks,
      publishedAt,
    };
  }

  async getAssessmentAnalytics(teacherUserId: string, assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: {
        assessmentId,
        teacherId: teacherUserId,
      },
      include: {
        questions: true,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: {
        assessmentId: assessment.id,
      },
      include: {
        answers: {
          include: {
            evaluation: true,
          },
        },
      },
    });

    const totalAttempts = attempts.length;
    const submittedAttempts = attempts.filter((a) => a.status === AssessmentAttemptStatus.SUBMITTED);
    const publishedResults = submittedAttempts.filter((a) => a.publishedAt != null);

    let averageMarks: number | null = null;
    let averagePercentage: number | null = null;
    let highestMarks: number | null = null;
    let lowestMarks: number | null = null;

    if (publishedResults.length > 0) {
      const sum = publishedResults.reduce((acc, curr) => acc + (curr.finalMarks ?? 0), 0);
      averageMarks = sum / publishedResults.length;

      if (assessment.maximumMarks > 0) {
        averagePercentage = (averageMarks / assessment.maximumMarks) * 100;
        averagePercentage = Math.round(averagePercentage * 10) / 10;
      }

      highestMarks = Math.max(...publishedResults.map(a => a.finalMarks ?? 0));
      lowestMarks = Math.min(...publishedResults.map(a => a.finalMarks ?? 0));
    }

    const questions = assessment.questions.map((question) => {
      let numberAnswered = 0;
      let sumMarks = 0;

      for (const attempt of publishedResults) {
        const answer = attempt.answers.find(a => a.questionId === question.id);
        if (answer) {
          numberAnswered++;
          const marks = answer.evaluation?.teacherMarks ?? answer.evaluation?.aiMarks ?? 0;
          sumMarks += marks;
        }
      }

      const numberUnanswered = publishedResults.length - numberAnswered;
      let qAverageMarks: number | null = null;
      let qAveragePercentage: number | null = null;

      if (publishedResults.length > 0) {
        qAverageMarks = sumMarks / publishedResults.length;
        if (question.marks > 0) {
          qAveragePercentage = (qAverageMarks / question.marks) * 100;
          qAveragePercentage = Math.round(qAveragePercentage * 10) / 10;
        }
      }

      return {
        questionId: question.questionId,
        prompt: question.prompt,
        maximumMarks: question.marks,
        numberAnswered,
        numberUnanswered,
        averageMarks: qAverageMarks,
        averagePercentage: qAveragePercentage,
      };
    });

    return {
      assessmentId: assessment.assessmentId,
      summary: {
        totalAttempts,
        submittedAttempts: submittedAttempts.length,
        publishedResults: publishedResults.length,
        averageMarks,
        averagePercentage,
        highestMarks,
        lowestMarks,
      },
      questions,
    };
  }

  private escapeCsvCell(value: string | number | Date | null | undefined): string {
    if (value == null) return '';

    let str = value instanceof Date ? value.toISOString() : String(value);

    // Formula injection protection (CWE-1236)
    if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
      str = "'" + str;
    }

    // CSV escaping (quotes, commas, newlines)
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  async exportResultsForTeacher(teacherUserId: string, assessmentId: string): Promise<string> {
    const assessment = await this.prisma.assessment.findUnique({
      where: {
        assessmentId,
        teacherId: teacherUserId,
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: {
        assessmentId: assessment.id,
        publishedAt: { not: null },
        finalMarks: { not: null },
        maximumMarks: { not: null },
      },
      include: {
        student: {
          include: { user: true },
        },
        answers: {
          include: { evaluation: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    // Headers
    const headers = [
      'Student Name',
      'Final Marks',
      'Maximum Marks',
      'Percentage',
      'Submitted At',
      'Published At',
    ];

    for (const q of assessment.questions) {
      headers.push(`Q${q.order + 1} (${q.marks} marks)`);
    }

    let csv = headers.map((h) => this.escapeCsvCell(h)).join(',') + '\n';

    // Rows
    for (const attempt of attempts) {
      const studentName = `${attempt.student.user.firstName} ${attempt.student.user.lastName}`.trim();
      let percentage = 0;
      if (attempt.maximumMarks! > 0) {
        percentage = (attempt.finalMarks! / attempt.maximumMarks!) * 100;
        percentage = Math.round(percentage * 10) / 10;
      }

      const row = [
        studentName,
        attempt.finalMarks,
        attempt.maximumMarks,
        percentage,
        attempt.submittedAt,
        attempt.publishedAt,
      ];

      for (const q of assessment.questions) {
        const answer = attempt.answers.find((a) => a.questionId === q.id);
        const marks = answer?.evaluation?.teacherMarks ?? answer?.evaluation?.aiMarks ?? 0;
        row.push(marks);
      }

      csv += row.map((c) => this.escapeCsvCell(c)).join(',') + '\n';
    }

    return csv;
  }

  async listAttemptsForTeacher(teacherUserId: string, assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: {
        assessmentId,
        teacherId: teacherUserId,
      },
      include: {
        questions: { select: { id: true } },
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: { assessmentId: assessment.id },
      include: {
        student: { include: { user: true } },
        answers: { include: { evaluation: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return attempts.map((attempt) => {
      let derivedStatus = 'IN_PROGRESS';

      if (attempt.publishedAt) {
        derivedStatus = 'PUBLISHED';
      } else if (attempt.status === AssessmentAttemptStatus.IN_PROGRESS) {
        derivedStatus = 'IN_PROGRESS';
      } else if (attempt.status === AssessmentAttemptStatus.SUBMITTED) {
        const evaluations = attempt.answers
          .map((a) => a.evaluation)
          .filter((e) => e != null);
        
        const hasFailed = evaluations.some((e) => e!.status === EvaluationStatus.FAILED);
        const hasGrading = evaluations.some(
          (e) => e!.status === EvaluationStatus.PENDING || e!.status === EvaluationStatus.EVALUATING,
        );
        const hasWaiting = evaluations.some(
          (e) => e!.status === EvaluationStatus.WAITING_FOR_REVIEW,
        );

        if (hasFailed) {
          derivedStatus = 'FAILED';
        } else if (hasGrading) {
          derivedStatus = 'GRADING';
        } else if (hasWaiting) {
          derivedStatus = 'WAITING_FOR_REVIEW';
        } else if (
          evaluations.length === attempt.answers.length && 
          evaluations.every((e) => e!.status === EvaluationStatus.APPROVED)
        ) {
          // Note: In phase 14 publication is blocked if any submitted answer has no evaluation.
          // By ensuring evaluations.length === attempt.answers.length we know there are no missing evaluations.
          derivedStatus = 'READY_TO_PUBLISH';
        } else {
          // Fallback if some answers somehow have no evaluation yet
          derivedStatus = 'GRADING';
        }
      }

      return {
        attemptId: attempt.attemptId,
        studentName: `${attempt.student.user.firstName} ${attempt.student.user.lastName}`.trim(),
        derivedStatus,
        submittedAt: attempt.submittedAt,
        publishedAt: attempt.publishedAt,
        finalMarks: attempt.finalMarks,
        maximumMarks: attempt.maximumMarks,
      };
    });
  }

  async bulkPublishAttemptResults(teacherUserId: string, assessmentId: string, attemptIds: string[]) {
    const assessment = await this.prisma.assessment.findUnique({
      where: {
        assessmentId,
        teacherId: teacherUserId,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const successful: string[] = [];
    const failed: { attemptId: string; reason: string }[] = [];

    for (const attemptId of attemptIds) {
      try {
        const attempt = await this.prisma.assessmentAttempt.findUnique({
          where: { attemptId },
          include: {
            answers: {
              include: { evaluation: true },
            },
            student: {
              select: { userId: true },
            },
          },
        });

        if (!attempt || attempt.assessmentId !== assessment.id) {
          failed.push({ attemptId, reason: 'Not found' });
          continue;
        }

        if (attempt.publishedAt) {
          failed.push({ attemptId, reason: 'Already published' });
          continue;
        }

        if (attempt.status !== AssessmentAttemptStatus.SUBMITTED) {
          failed.push({ attemptId, reason: 'Attempt not submitted' });
          continue;
        }

        const missingEvaluation = attempt.answers.some((a) => !a.evaluation);
        if (missingEvaluation) {
          failed.push({ attemptId, reason: 'Not ready to publish (missing evaluation)' });
          continue;
        }

        const hasNonApproved = attempt.answers.some(
          (a) => a.evaluation!.status !== EvaluationStatus.APPROVED,
        );

        if (hasNonApproved) {
          failed.push({ attemptId, reason: 'Not ready to publish (incomplete review)' });
          continue;
        }

        // It is ready to publish, let's call the internal logic of publishAttemptResult
        // or just calculate the marks right here to avoid re-fetching
        const questions = await this.prisma.question.findMany({
          where: { assessmentId: assessment.id },
        });

        const maximumMarks = questions.reduce((sum, q) => sum + q.marks, 0);
        
        let finalMarks = 0;
        for (const q of questions) {
          const ans = attempt.answers.find((a) => a.questionId === q.id);
          if (ans && ans.evaluation) {
            finalMarks += ans.evaluation.teacherMarks ?? ans.evaluation.aiMarks ?? 0;
          }
        }

        await this.prisma.assessmentAttempt.update({
          where: { id: attempt.id },
          data: {
            publishedAt: new Date(),
            finalMarks,
            maximumMarks,
          },
        });

        this.eventEmitter.emit(
          'assessment.result_published',
          new AssessmentResultPublishedEvent(
            attempt.attemptId,
            attempt.student.userId,
            assessment.title
          )
        );

        successful.push(attemptId);
      } catch (error) {
        failed.push({ attemptId, reason: 'Internal error' });
      }
    }

    return { successful, failed };
  }
}
