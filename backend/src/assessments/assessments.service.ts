import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AssessmentStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { generateAssessmentId } from './utils/assessment.util';
import { ListAssessmentsDto } from './dto/list-assessments.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
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

    durationMinutes: dto.durationMinutes ?? null,

    instructions:
      dto.instructions === undefined
        ? null
        : dto.instructions.trim(),

    startAt: startAt ?? null,
    endAt: endAt ?? null,

    status: AssessmentStatus.DRAFT,
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
}