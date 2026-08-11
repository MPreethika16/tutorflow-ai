import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

import { StudentAssessmentsController } from './student-assessments.controller';
import { StudentAssessmentsService } from './student-assessments.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
  ],

  controllers: [
    StudentAssessmentsController,
  ],

  providers: [
    StudentAssessmentsService,
  ],
})
export class StudentAssessmentsModule {}