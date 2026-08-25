import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { QuestionsModule } from './questions/questions.module';
import { StudentAssessmentsModule } from './student-assessments/student-assessments.module';
import { AiModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ...(process.env.NODE_ENV === 'test' ? [] : [ScheduleModule.forRoot()]),
    EventEmitterModule.forRoot(),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    StudentsModule,
    AssessmentsModule,
    QuestionsModule,
    StudentAssessmentsModule,
    AiModule,
    NotificationsModule,
  ],
})
export class AppModule {}