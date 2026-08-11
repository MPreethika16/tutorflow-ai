import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  AssessmentStatus,
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

  const studentEmail =
    'student-assessments-e2e@test.com';

  const studentPassword =
    'StudentTest123!';

  const createdAssessmentIds: string[] = [];

  beforeAll(async () => {
    // ------------------------------------------------
    // Start the real Nest application.
    // ------------------------------------------------
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();

    prisma = app.get(PrismaService);

    // ------------------------------------------------
    // Seed our reusable teacher.
    // ------------------------------------------------
    const teacher =
      await seedTestTeacher(app);

    teacherUserId = teacher.id;

    // ------------------------------------------------
    // Login as teacher.
    //
    // We need this later to verify that a teacher
    // cannot access the student-only endpoint.
    // ------------------------------------------------
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
    // Create a predictable test student.
    // ------------------------------------------------
    const passwordHash =
      await bcrypt.hash(
        studentPassword,
        12,
      );

    // Remove an older version of this fixture
    // if a previous test run left it behind.
    const existingStudentUser =
      await prisma.user.findUnique({
        where: {
          email: studentEmail,
        },
        select: {
          id: true,
        },
      });

    if (existingStudentUser) {
      await prisma.user.delete({
        where: {
          id: existingStudentUser.id,
        },
      });
    }

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
                `STU-E2E-${Date.now()}`,

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

    // ------------------------------------------------
    // Login as student.
    // ------------------------------------------------
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
    // ------------------------------------------------
    // Clean up only records created by this suite.
    // ------------------------------------------------

    if (createdAssessmentIds.length > 0) {
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

    await app.close();
  });

  // ==================================================
  // TEST 1
  //
  // Matching published assessment should be visible.
  // ==================================================
  it('returns matching published assessment as AVAILABLE', async () => {
    const now = new Date();

    const startAt = new Date(
      now.getTime() - 60 * 60 * 1000,
    );

    const endAt = new Date(
      now.getTime() + 60 * 60 * 1000,
    );

    const publicAssessmentId =
      `ASM-E2E-AVAILABLE-${Date.now()}`;

    createdAssessmentIds.push(
      publicAssessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId:
          publicAssessmentId,

        teacherId:
          teacherUserId,

        title:
          'Available E2E Assessment',

        description:
          'Visible to CBSE grade 10 student',

        board: 'CBSE',
        grade: '10',
        subject: 'Science',

        durationMinutes: 60,

        maximumMarks: 20,

        startAt,
        endAt,

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
          publicAssessmentId,
      );

    expect(assessment).toBeDefined();

    expect(
      assessment.assessmentId,
    ).toBe(publicAssessmentId);

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

  // ==================================================
  // TEST 2
  //
  // Different board/grade must not be returned.
  // ==================================================
  it('does not return assessment for another board or grade', async () => {
    const now = new Date();

    const startAt = new Date(
      now.getTime() - 60 * 60 * 1000,
    );

    const endAt = new Date(
      now.getTime() + 60 * 60 * 1000,
    );

    const wrongGradeAssessmentId =
      `ASM-E2E-WRONG-GRADE-${Date.now()}`;

    createdAssessmentIds.push(
      wrongGradeAssessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId:
          wrongGradeAssessmentId,

        teacherId:
          teacherUserId,

        title:
          'Grade 9 Assessment',

        board: 'CBSE',

        // Student is grade 10.
        grade: '9',

        subject: 'Science',

        durationMinutes: 60,

        maximumMarks: 20,

        startAt,
        endAt,

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
          wrongGradeAssessmentId,
      );

    expect(assessment).toBeUndefined();
  });

  // ==================================================
  // TEST 3
  //
  // Teacher must not access student endpoint.
  // ==================================================
  it('rejects teacher access', async () => {
    await request(
      app.getHttpServer(),
    )
      .get('/student/assessments')
      .set(
        'Authorization',
        `Bearer ${teacherToken}`,
      )
      .expect(403);
  });

  // ==================================================
  // Bonus security test:
  //
  // No JWT should return 401.
  // ==================================================
  it('rejects unauthenticated access', async () => {
    await request(
      app.getHttpServer(),
    )
      .get('/student/assessments')
      .expect(401);
  });
});