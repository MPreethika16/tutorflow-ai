import { Body, Controller, Post } from '@nestjs/common';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('teachers')
  createTeacher(@Body() dto: CreateTeacherDto) {
    return this.usersService.createTeacher(dto);
  }
}