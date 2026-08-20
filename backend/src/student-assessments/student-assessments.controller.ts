import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
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

import { SaveStudentAnswerDto } from './dto/save-student-answer.dto';
import { StudentAssessmentsService } from './student-assessments.service';

@Controller('student')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
@Roles(UserRole.STUDENT)
export class StudentAssessmentsController {
  constructor(
    private readonly studentAssessmentsService:
      StudentAssessmentsService,
  ) {}

  @Get('assessments')
  listAvailableAssessments(
    @CurrentUser() user: JwtPayload,
  ) {
    return this.studentAssessmentsService
      .findAvailableForStudent(
        user.sub,
      );
  }

  @Post(
    'assessments/:assessmentId/start',
  )
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
    @Param('attemptId')
    attemptId: string,
  ) {
    return this.studentAssessmentsService
      .getAttemptForStudent(
        user.sub,
        attemptId,
      );
  }

  @Put(
    'attempts/:attemptId/answers/:questionId',
  )
  saveAnswer(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId')
    attemptId: string,
    @Param('questionId')
    questionId: string,
    @Body()
    dto: SaveStudentAnswerDto,
  ) {
    return this.studentAssessmentsService
      .saveAnswerForStudent(
        user.sub,
        attemptId,
        questionId,
        dto,
      );
  }

  @Post('attempts/:attemptId/submit')
submitAttempt(
  @CurrentUser() user: JwtPayload,
  @Param('attemptId')
  attemptId: string,
) {
  return this.studentAssessmentsService
    .submitAttemptForStudent(
      user.sub,
      attemptId,
    );
}

  @Get('attempts/:attemptId/result')
  getResult(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId') attemptId: string,
  ) {
    return this.studentAssessmentsService.getResultForStudent(
      user.sub,
      attemptId,
    );
  }
}