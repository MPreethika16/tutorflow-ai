import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PaperGenerationService } from '../src/ai/paper-generation.service';
import {
  UserRole,
  UserStatus,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

import { seedTestTeacher } from './utils/seed-test-teacher';

describe('AI Paper Generation API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let teacherToken: string;
  let studentToken: string;
  let teacherUserId: string;

  const runId = Date.now();

  const studentEmail =
    `ai-paper-student-${runId}@test.com`;

  const studentPassword =
    'StudentTest123!';

  const generateAndSaveDraftMock =
    jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(
          PaperGenerationService,
        )
        .useValue({
          generateAndSaveDraft:
            generateAndSaveDraftMock,
        })
        .compile();

    app =
      moduleFixture.createNestApplication();

    await app.init();

    prisma =
      app.get(PrismaService);

    // ----------------------------------
    // Teacher setup
    // ----------------------------------

    const teacher =
      await seedTestTeacher(app);

    teacherUserId =
      teacher.id;

    const teacherLoginResponse =
      await request(
        app.getHttpServer(),
      )
        .post('/auth/login')
        .send({
          email:
            process.env
              .TEST_TEACHER_EMAIL,

          password:
            process.env
              .TEST_TEACHER_PASSWORD,
        })
        .expect(200);

    teacherToken =
      teacherLoginResponse.body
        .accessToken;

    // ----------------------------------
    // Student setup
    // ----------------------------------

    const passwordHash =
      await bcrypt.hash(
        studentPassword,
        12,
      );

    await prisma.user.create({
      data: {
        firstName: 'AI',
        lastName: 'Student',

        email: studentEmail,

        passwordHash,

        role:
          UserRole.STUDENT,

        status:
          UserStatus.ACTIVE,

        student: {
          create: {
            teacherId:
              teacherUserId,

            studentId:
              `STU-AI-${runId}`,

            board: 'CBSE',
            grade: '10',

            mustChangePassword:
              false,
          },
        },
      },
    });

    const studentLoginResponse =
      await request(
        app.getHttpServer(),
      )
        .post('/auth/login')
        .send({
          email: studentEmail,
          password:
            studentPassword,
        })
        .expect(200);

    studentToken =
      studentLoginResponse.body
        .accessToken;
  });

  beforeEach(() => {
    generateAndSaveDraftMock
      .mockReset();

    generateAndSaveDraftMock
      .mockImplementation(
        async (
          _teacherUserId: string,
          dto: {
            kind: string;
            board: string;
            grade: string;
            subject: string;
            durationMinutes: number;
            totalMarks: number;
          },
        ) => ({
          assessmentId:
            `ASM-AI-${runId}`,

          title:
            dto.kind === 'TEST'
              ? 'Quadratic Equations Test'
              : 'Quadratic Equations Practice',

          board: dto.board,
          grade: dto.grade,
          subject: dto.subject,

          kind: dto.kind,

          source:
            'AI_GENERATED',

          durationMinutes:
            dto.durationMinutes,

          maximumMarks:
            dto.totalMarks,

          status: 'DRAFT',
        }),
      );
  });

afterAll(async () => {
  if (prisma) {
    await prisma.user.deleteMany({
      where: {
        email: studentEmail,
      },
    });
  }

  if (app) {
    await app.close();
  }
});
  it('allows teacher to generate an AI TEST draft', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          '/ai/papers/generate',
        )
        .set(
          'Authorization',
          `Bearer ${teacherToken}`,
        )
        .send({
          board: 'CBSE',
          grade: '10',

          subject:
            'Mathematics',

          topic:
            'Quadratic Equations',

          kind: 'TEST',

          totalMarks: 20,

          durationMinutes: 30,
        })
        .expect(201);

    expect(
      response.body.kind,
    ).toBe('TEST');

    expect(
      response.body.source,
    ).toBe('AI_GENERATED');

    expect(
      response.body.status,
    ).toBe('DRAFT');

    expect(
      response.body.maximumMarks,
    ).toBe(20);

    expect(
      generateAndSaveDraftMock,
    ).toHaveBeenCalledTimes(1);

    expect(
      generateAndSaveDraftMock,
    ).toHaveBeenCalledWith(
      teacherUserId,
      expect.objectContaining({
        board: 'CBSE',
        grade: '10',

        subject:
          'Mathematics',

        topic:
          'Quadratic Equations',

        kind: 'TEST',

        totalMarks: 20,

        durationMinutes: 30,
      }),
    );
  });

  it('allows teacher to generate an AI PRACTICE draft', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          '/ai/papers/generate',
        )
        .set(
          'Authorization',
          `Bearer ${teacherToken}`,
        )
        .send({
          board: 'CBSE',
          grade: '10',

          subject:
            'Mathematics',

          topic:
            'Quadratic Equations',

          kind:
            'PRACTICE',

          totalMarks: 10,

          durationMinutes: 20,

          additionalInstructions:
            'Focus on revision.',
        })
        .expect(201);

    expect(
      response.body.kind,
    ).toBe('PRACTICE');

    expect(
      response.body.source,
    ).toBe('AI_GENERATED');

    expect(
      response.body.status,
    ).toBe('DRAFT');

    expect(
      generateAndSaveDraftMock,
    ).toHaveBeenCalledTimes(1);
  });

  it('rejects student access to AI paper generation', async () => {
    await request(
      app.getHttpServer(),
    )
      .post(
        '/ai/papers/generate',
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .send({
        board: 'CBSE',
        grade: '10',

        subject:
          'Mathematics',

        topic:
          'Quadratic Equations',

        kind: 'TEST',

        totalMarks: 20,

        durationMinutes: 30,
      })
      .expect(403);

    expect(
      generateAndSaveDraftMock,
    ).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated AI paper generation', async () => {
    await request(
      app.getHttpServer(),
    )
      .post(
        '/ai/papers/generate',
      )
      .send({
        board: 'CBSE',
        grade: '10',

        subject:
          'Mathematics',

        topic:
          'Quadratic Equations',

        kind: 'TEST',

        totalMarks: 20,

        durationMinutes: 30,
      })
      .expect(401);

    expect(
      generateAndSaveDraftMock,
    ).not.toHaveBeenCalled();
  });
});