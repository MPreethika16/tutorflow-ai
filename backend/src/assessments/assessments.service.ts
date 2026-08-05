import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AssessmentStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { generateAssessmentId } from './utils/assessment.util';

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
}