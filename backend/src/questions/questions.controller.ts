import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionsService } from './questions.service';

@Controller('assessments/:assessmentId/questions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
  ) {}

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

  @Patch('reorder')
  reorderQuestions(
    @CurrentUser() user: JwtPayload,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: ReorderQuestionsDto,
  ) {
    return this.questionsService.reorderForTeacher(
      user.sub,
      assessmentId,
      dto,
    );
  }

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

  @Get(':questionId')
  getQuestion(
    @CurrentUser() user: JwtPayload,
    @Param('assessmentId') assessmentId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.questionsService.findOneForTeacher(
      user.sub,
      assessmentId,
      questionId,
    );
  }

  @Delete(':questionId')
  deleteQuestion(
    @CurrentUser() user: JwtPayload,
    @Param('assessmentId') assessmentId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.questionsService.deleteForTeacher(
      user.sub,
      assessmentId,
      questionId,
    );
  }
}