import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { ListAssessmentsDto } from './dto/list-assessments.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';

@Controller('assessments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class AssessmentsController {
  constructor(
    private readonly assessmentsService: AssessmentsService,
  ) {}

  @Post()
  createAssessment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.assessmentsService.create(user.sub, dto);
  }

  @Get()
  listAssessments(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListAssessmentsDto,
  ) {
    return this.assessmentsService.findAllForTeacher(
      user.sub,
      query,
    );
  }


  @Get('stats')
getAssessmentStatistics(
  @CurrentUser() user: JwtPayload,
) {
  return this.assessmentsService.getStatisticsForTeacher(
    user.sub,
  );
}


  @Get(':assessmentId')
  getAssessment(
    @CurrentUser() user: JwtPayload,
    @Param('assessmentId') assessmentId: string,
  ) {
    return this.assessmentsService.findOneForTeacher(
      user.sub,
      assessmentId,
    );
  }

  @Patch(':assessmentId')
  updateAssessment(
    @CurrentUser() user: JwtPayload,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: UpdateAssessmentDto,
  ) {
    return this.assessmentsService.updateForTeacher(
      user.sub,
      assessmentId,
      dto,
    );
  }

 @Post(':assessmentId/publish')
publishAssessment(
  @CurrentUser() user: JwtPayload,
  @Param('assessmentId') assessmentId: string,
) {
  return this.assessmentsService.publishForTeacher(
    user.sub,
    assessmentId,
  );
}

@Post(':assessmentId/close')
closeAssessment(
  @CurrentUser() user: JwtPayload,
  @Param('assessmentId') assessmentId: string,
) {
  return this.assessmentsService.closeForTeacher(
    user.sub,
    assessmentId,
  );
}

@Post(':assessmentId/archive')
archiveAssessment(
  @CurrentUser() user: JwtPayload,
  @Param('assessmentId') assessmentId: string,
) {
  return this.assessmentsService.archiveForTeacher(
    user.sub,
    assessmentId,
  );
}


}