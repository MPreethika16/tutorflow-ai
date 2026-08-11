import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { UserRole } from '../generated/prisma/client';

import { StudentAssessmentsService } from './student-assessments.service';

@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class StudentAssessmentsController {
  constructor(
    private readonly studentAssessmentsService:
      StudentAssessmentsService,
  ) {}

  /**
   * Lists assessments the logged-in student
   * can currently start or resume.
   */
  @Get('assessments')
  listAvailableAssessments(
    @CurrentUser() user: JwtPayload,
  ) {
    return this.studentAssessmentsService
      .findAvailableForStudent(user.sub);
  }

  /**
   * Starts an assessment attempt.
   *
   * No body is required.
   * Student identity comes from JWT.
   */
  @Post('assessments/:assessmentId/start')
  async startAssessment(
    @CurrentUser() user: JwtPayload,

    @Param('assessmentId')
    assessmentId: string,

    @Res({ passthrough: true })
    response: Response,
  ) {
    const result =
      await this.studentAssessmentsService
        .startAssessmentForStudent(
          user.sub,
          assessmentId,
        );

    // New attempt:
    // 201 Created
    //
    // Existing active attempt:
    // 200 OK because we are returning it
    // for resume rather than creating another.
    response.status(
      result.created
        ? HttpStatus.CREATED
        : HttpStatus.OK,
    );

    return result.data;
  }

  @Get('attempts/:attemptId')
getAttempt(
  @CurrentUser() user: JwtPayload,
  @Param('attemptId') attemptId: string,
) {
  return this.studentAssessmentsService
    .getAttemptForStudent(
      user.sub,
      attemptId,
    );
}
}