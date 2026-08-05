import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { UserRole } from '../generated/prisma/client';

import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';

@Controller('assessments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class AssessmentsController {
  constructor(
    private readonly assessmentsService: AssessmentsService,
  ) {}

  /**
   * Creates a new assessment draft.
   *
   * The teacher ID is taken from the JWT.
   * The frontend does not send teacherId.
   */
  @Post()
  createAssessment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.assessmentsService.create(
      user.sub,
      dto,
    );
  }
}