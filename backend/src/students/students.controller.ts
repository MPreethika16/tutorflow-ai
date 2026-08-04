import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateStudentDto } from './dto/create-student.dto';
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
}