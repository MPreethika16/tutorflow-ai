import {
  Body,
  Controller,
  Get,
   Param,
    Patch,
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
import { UpdateStudentDto } from './dto/update-student.dto';
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

  @Get()
findAllStudents(@CurrentUser() user: JwtPayload) {
  return this.studentsService.findAllForTeacher(user.sub);
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
}