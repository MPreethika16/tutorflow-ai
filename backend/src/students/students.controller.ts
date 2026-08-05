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

import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsDto } from './dto/list-students.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
  ) {}

  @Post()
  createStudent(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStudentDto,
  ) {
    return this.studentsService.create(user.sub, dto);
  }

  @Get('stats')
  getStudentStatistics(
    @CurrentUser() user: JwtPayload,
  ) {
    return this.studentsService.getStatisticsForTeacher(
      user.sub,
    );
  }

  @Get()
  findAllStudents(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListStudentsDto,
  ) {
    return this.studentsService.findAllForTeacher(
      user.sub,
      query,
    );
  }

  @Get(':id')
  findOneStudent(
    @CurrentUser() user: JwtPayload,
    @Param('id') studentUserId: string,
  ) {
    return this.studentsService.findOneForTeacher(
      user.sub,
      studentUserId,
    );
  }

  @Patch(':studentId')
  updateStudent(
    @CurrentUser() user: JwtPayload,
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.updateForTeacher(
      user.sub,
      studentId,
      dto,
    );
  }

  @Post(':studentId/reset-password')
  resetStudentPassword(
    @CurrentUser() user: JwtPayload,
    @Param('studentId') studentId: string,
  ) {
    return this.studentsService.resetPasswordForTeacher(
      user.sub,
      studentId,
    );
  }

  @Patch(':studentId/deactivate')
  deactivateStudent(
    @CurrentUser() user: JwtPayload,
    @Param('studentId') studentId: string,
  ) {
    return this.studentsService.deactivateForTeacher(
      user.sub,
      studentId,
    );
  }

  @Patch(':studentId/activate')
  activateStudent(
    @CurrentUser() user: JwtPayload,
    @Param('studentId') studentId: string,
  ) {
    return this.studentsService.activateForTeacher(
      user.sub,
      studentId,
    );
  }
}