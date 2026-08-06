import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
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
import { UpdateQuestionDto } from './dto/update-question.dto';
@Controller('assessments/:assessmentId/questions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
  ) {}

  /**
   * Creates a question inside an owned draft assessment.
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

  /**
   * Lists every question belonging to an owned assessment.
   *
   * Questions are returned according to their saved order.
   */
  @Get()
  listQuestions(
    @CurrentUser() user: JwtPayload,
    @Param('assessmentId') assessmentId: string,
  ) {
    return this.questionsService.findAllForTeacher(
      user.sub,
      assessmentId,
    );
  }

  /**
 * Updates one question inside an owned draft assessment.
 */
@Patch(':questionId')
updateQuestion(
  @CurrentUser() user: JwtPayload,
  @Param('assessmentId') assessmentId: string,
  @Param('questionId') questionId: string,
  @Body() dto: UpdateQuestionDto,
) {
  return this.questionsService.updateForTeacher(
    user.sub,
    assessmentId,
    questionId,
    dto,
  );
}
}