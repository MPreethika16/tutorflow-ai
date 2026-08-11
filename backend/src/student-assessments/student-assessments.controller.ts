import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { UserRole } from '../generated/prisma/client';

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
}