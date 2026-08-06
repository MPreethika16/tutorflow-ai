import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { UserRole } from '../generated/prisma/client';

import { CreateQuestionDto } from './dto/create-question.dto';
import { QuestionsService } from './questions.service';

@Controller('assessments/:assessmentId/questions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
  ) {}

  /**
   * Creates a question inside an owned draft assessment.
   *
   * teacherUserId comes from JWT.
   * assessmentId comes from the URL.
   * question data comes from the validated body.
   */
  @Post()
  createQuestion(
    @CurrentUser() user: JwtPayload,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questionsService.createForTeacher(
      user.sub,
      assessmentId,
      dto,
    );
  }
}