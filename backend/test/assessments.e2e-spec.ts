import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  AssessmentStatus,
  QuestionType,
  UserRole,
  UserStatus,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedTestTeacher } from './utils/seed-test-teacher';

describe('Student Assessments API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let teacherToken: string;
  let studentToken: string;

  let teacherUserId: string;
  let studentUserId: string;

  let startedAssessmentId: string;
  let startedAttemptId: string;

  const runId = Date.now();

  const studentEmail =
    `student-assessments-${runId}@test.com`;

  const studentPassword =
    'StudentTest123!';

  const createdAssessmentIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();

    prisma = app.get(PrismaService);

    // ------------------------------------------------
    // Seed and login the reusable E2E teacher.
    // ------------------------------------------------
    const teacher =
      await seedTestTeacher(app);

    teacherUserId = teacher.id;

    const teacherLoginResponse =
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email:
            process.env.TEST_TEACHER_EMAIL,
          password:
            process.env.TEST_TEACHER_PASSWORD,
        })
        .expect(200);

    teacherToken =
      teacherLoginResponse.body.accessToken;

    // ------------------------------------------------
    // Create a fresh student for this test run.
    // ------------------------------------------------
    const passwordHash =
      await bcrypt.hash(
        studentPassword,
        12,
      );

    const studentUser =
      await prisma.user.create({
        data: {
          firstName: 'E2E',
          lastName: 'Student',
          email: studentEmail,
          passwordHash,
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,

          student: {
            create: {
              teacherId: teacherUserId,

              studentId:
                `STU-E2E-${runId}`,

              board: 'CBSE',
              grade: '10',

              mustChangePassword: false,
            },
          },
        },

        select: {
          id: true,
        },
      });

    studentUserId = studentUser.id;

    const studentLoginResponse =
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: studentEmail,
          password: studentPassword,
        })
        .expect(200);

    studentToken =
      studentLoginResponse.body.accessToken;
  });

  afterAll(async () => {
    if (prisma) {
      // Attempts restrict assessment/student deletion,
      // so remove them before deleting their parents.
      if (createdAssessmentIds.length > 0) {
        await prisma.studentAnswer.deleteMany({
          where: {
            attempt: {
              assessment: {
                assessmentId: {
                  in: createdAssessmentIds,
                },
              },
            },
          },
        });

        await prisma.assessmentAttempt.deleteMany({
          where: {
            assessment: {
              assessmentId: {
                in: createdAssessmentIds,
              },
            },
          },
        });

        await prisma.assessment.deleteMany({
          where: {
            assessmentId: {
              in: createdAssessmentIds,
            },
          },
        });
      }

      if (studentUserId) {
        await prisma.user.delete({
          where: {
            id: studentUserId,
          },
        });
      }
    }

    if (app) {
      await app.close();
    }
  });

  // ==================================================
  // ISSUE #28 — LIST AVAILABLE ASSESSMENTS
  // ==================================================

  it('returns matching published assessment as AVAILABLE', async () => {
    const now = new Date();

    const assessmentId =
      `ASM-E2E-AVAILABLE-${Date.now()}`;

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId: teacherUserId,

        title:
          'Available E2E Assessment',

        description:
          'Visible to CBSE grade 10 student',

        board: 'CBSE',
        grade: '10',
        subject: 'Science',

        durationMinutes: 60,
        maximumMarks: 20,

        startAt: new Date(
          now.getTime() -
            60 * 60 * 1000,
        ),

        endAt: new Date(
          now.getTime() +
            60 * 60 * 1000,
        ),

        status:
          AssessmentStatus.PUBLISHED,
      },
    });

    const response = await request(
      app.getHttpServer(),
    )
      .get('/student/assessments')
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(200);

    const assessment =
      response.body.assessments.find(
        (item: {
          assessmentId: string;
        }) =>
          item.assessmentId ===
          assessmentId,
      );

    expect(assessment).toBeDefined();

    expect(
      assessment.attemptStatus,
    ).toBe('AVAILABLE');

    expect(
      assessment.attemptId,
    ).toBeNull();

    expect(
      assessment.board,
    ).toBe('CBSE');

    expect(
      assessment.grade,
    ).toBe('10');
  });

  it('does not return assessment for another board or grade', async () => {
    const now = new Date();

    const assessmentId =
      `ASM-E2E-WRONG-GRADE-${Date.now()}`;

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId: teacherUserId,

        title:
          'Wrong Grade Assessment',

        board: 'CBSE',
        grade: '9',
        subject: 'Science',

        durationMinutes: 60,
        maximumMarks: 20,

        startAt: new Date(
          now.getTime() -
            60 * 60 * 1000,
        ),

        endAt: new Date(
          now.getTime() +
            60 * 60 * 1000,
        ),

        status:
          AssessmentStatus.PUBLISHED,
      },
    });

    const response = await request(
      app.getHttpServer(),
    )
      .get('/student/assessments')
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(200);

    const assessment =
      response.body.assessments.find(
        (item: {
          assessmentId: string;
        }) =>
          item.assessmentId ===
          assessmentId,
      );

    expect(assessment).toBeUndefined();
  });

  it('rejects teacher access to the student assessment list', async () => {
    await request(app.getHttpServer())
      .get('/student/assessments')
      .set(
        'Authorization',
        `Bearer ${teacherToken}`,
      )
      .expect(403);
  });

  it('rejects unauthenticated access to the student assessment list', async () => {
    await request(app.getHttpServer())
      .get('/student/assessments')
      .expect(401);
  });

  // ==================================================
  // ISSUE #29 — START ASSESSMENT ATTEMPT
  // ==================================================

  it('starts a new assessment attempt', async () => {
    const now = new Date();

    const startAt = new Date(
      now.getTime() -
        60 * 60 * 1000,
    );

    const endAt = new Date(
      now.getTime() +
        2 * 60 * 60 * 1000,
    );

    startedAssessmentId =
      `ASM-E2E-START-${Date.now()}`;

    createdAssessmentIds.push(
      startedAssessmentId,
    );

    const assessment =
      await prisma.assessment.create({
        data: {
          assessmentId:
            startedAssessmentId,

          teacherId:
            teacherUserId,

          title:
            'Start Attempt E2E Test',

          board: 'CBSE',
          grade: '10',
          subject: 'Science',

          durationMinutes: 60,
          maximumMarks: 5,

          startAt,
          endAt,

          status:
            AssessmentStatus.PUBLISHED,

          questions: {
            create: {
              questionId:
                `QUE-E2E-${Date.now()}`,

              type:
                QuestionType.TYPED,

              prompt:
                'Explain photosynthesis.',

              marks: 5,
              order: 1,

              modelAnswer:
                'Plants use light energy to make glucose.',
            },
          },
        },

        select: {
          assessmentId: true,
        },
      });

    const response = await request(
      app.getHttpServer(),
    )
      .post(
        `/student/assessments/${assessment.assessmentId}/start`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(201);

    expect(
      response.body.attempt,
    ).toBeDefined();

    expect(
      response.body.attempt.attemptId,
    ).toMatch(
      /^ATT-[A-F0-9]+$/,
    );

    startedAttemptId =
      response.body.attempt.attemptId;

    expect(
      response.body.attempt.status,
    ).toBe('IN_PROGRESS');

    expect(
      response.body.attempt.startedAt,
    ).toBeDefined();

    expect(
      response.body.attempt.expiresAt,
    ).toBeDefined();

    expect(
      response.body.assessment
        .assessmentId,
    ).toBe(startedAssessmentId);

    const savedAttempt =
      await prisma
        .assessmentAttempt
        .findUnique({
          where: {
            attemptId:
              startedAttemptId,
          },
        });

    expect(
      savedAttempt,
    ).not.toBeNull();

    expect(
      savedAttempt?.studentUserId,
    ).toBe(studentUserId);
  });

  it('returns the existing IN_PROGRESS attempt when start is called again', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .post(
        `/student/assessments/${startedAssessmentId}/start`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(200);

    expect(
      response.body.attempt.attemptId,
    ).toBe(startedAttemptId);

    expect(
      response.body.attempt.status,
    ).toBe('IN_PROGRESS');

    const assessment =
      await prisma.assessment
        .findUniqueOrThrow({
          where: {
            assessmentId:
              startedAssessmentId,
          },

          select: {
            id: true,
          },
        });

    const attemptCount =
      await prisma.assessmentAttempt.count({
        where: {
          studentUserId,

          assessmentId:
            assessment.id,
        },
      });

    expect(
      attemptCount,
    ).toBe(1);
  });

  it('rejects starting an assessment that was already submitted', async () => {
    await prisma.assessmentAttempt.update({
      where: {
        attemptId:
          startedAttemptId,
      },

      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    await request(app.getHttpServer())
      .post(
        `/student/assessments/${startedAssessmentId}/start`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(409);
  });

  it('rejects starting an upcoming assessment', async () => {
    const now = new Date();

    const assessmentId =
      `ASM-E2E-UPCOMING-${Date.now()}`;

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId: teacherUserId,

        title:
          'Upcoming Assessment',

        board: 'CBSE',
        grade: '10',
        subject: 'Science',

        durationMinutes: 60,
        maximumMarks: 5,

        startAt: new Date(
          now.getTime() +
            60 * 60 * 1000,
        ),

        endAt: new Date(
          now.getTime() +
            2 * 60 * 60 * 1000,
        ),

        status:
          AssessmentStatus.PUBLISHED,

        questions: {
          create: {
            questionId:
              `QUE-E2E-UPCOMING-${Date.now()}`,

            type:
              QuestionType.TYPED,

            prompt:
              'Upcoming assessment question',

            marks: 5,
            order: 1,

            modelAnswer:
              'Example answer.',
          },
        },
      },
    });

    await request(app.getHttpServer())
      .post(
        `/student/assessments/${assessmentId}/start`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(409);
  });

  it('rejects starting an expired assessment', async () => {
    const now = new Date();

    const assessmentId =
      `ASM-E2E-EXPIRED-${Date.now()}`;

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId: teacherUserId,

        title:
          'Expired Assessment',

        board: 'CBSE',
        grade: '10',
        subject: 'Science',

        durationMinutes: 60,
        maximumMarks: 5,

        startAt: new Date(
          now.getTime() -
            2 * 60 * 60 * 1000,
        ),

        endAt: new Date(
          now.getTime() -
            60 * 60 * 1000,
        ),

        status:
          AssessmentStatus.PUBLISHED,

        questions: {
          create: {
            questionId:
              `QUE-E2E-EXPIRED-${Date.now()}`,

            type:
              QuestionType.TYPED,

            prompt:
              'Expired assessment question',

            marks: 5,
            order: 1,

            modelAnswer:
              'Example answer.',
          },
        },
      },
    });

    await request(app.getHttpServer())
      .post(
        `/student/assessments/${assessmentId}/start`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(409);
  });

  it('returns 404 when assessment does not match student board or grade', async () => {
    const now = new Date();

    const assessmentId =
      `ASM-E2E-WRONG-BOARD-${Date.now()}`;

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId: teacherUserId,

        title:
          'Different Board Assessment',

        board: 'ICSE',
        grade: '10',
        subject: 'Science',

        durationMinutes: 60,
        maximumMarks: 5,

        startAt: new Date(
          now.getTime() -
            60 * 60 * 1000,
        ),

        endAt: new Date(
          now.getTime() +
            60 * 60 * 1000,
        ),

        status:
          AssessmentStatus.PUBLISHED,

        questions: {
          create: {
            questionId:
              `QUE-E2E-WRONG-BOARD-${Date.now()}`,

            type:
              QuestionType.TYPED,

            prompt:
              'Different board question',

            marks: 5,
            order: 1,

            modelAnswer:
              'Example answer.',
          },
        },
      },
    });

    await request(app.getHttpServer())
      .post(
        `/student/assessments/${assessmentId}/start`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(404);
  });

  it('returns 404 when assessment does not exist', async () => {
    await request(app.getHttpServer())
      .post(
        '/student/assessments/ASM-DOES-NOT-EXIST/start',
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(404);
  });

  it('rejects teacher from starting a student assessment', async () => {
    await request(app.getHttpServer())
      .post(
        `/student/assessments/${startedAssessmentId}/start`,
      )
      .set(
        'Authorization',
        `Bearer ${teacherToken}`,
      )
      .expect(403);
  });

  it('caps attempt expiry at assessment endAt', async () => {
    const now = new Date();

    const endAt = new Date(
      now.getTime() +
        5 * 60 * 1000,
    );

    const assessmentId =
      `ASM-E2E-CAPPED-${Date.now()}`;

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId: teacherUserId,

        title:
          'Expiry Cap Assessment',

        board: 'CBSE',
        grade: '10',
        subject: 'Science',

        durationMinutes: 60,
        maximumMarks: 5,

        startAt: new Date(
          now.getTime() -
            5 * 60 * 1000,
        ),

        endAt,

        status:
          AssessmentStatus.PUBLISHED,

        questions: {
          create: {
            questionId:
              `QUE-E2E-CAPPED-${Date.now()}`,

            type:
              QuestionType.TYPED,

            prompt:
              'Expiry cap question',

            marks: 5,
            order: 1,

            modelAnswer:
              'Example answer.',
          },
        },
      },
    });

    const response = await request(
      app.getHttpServer(),
    )
      .post(
        `/student/assessments/${assessmentId}/start`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(201);

    const expiresAt = new Date(
      response.body.attempt.expiresAt,
    );

    expect(
      expiresAt.getTime(),
    ).toBe(endAt.getTime());
  });
});
