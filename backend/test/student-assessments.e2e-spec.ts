import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  AssessmentAttemptStatus,
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
  let otherStudentToken: string;

  let teacherUserId: string;
  let studentUserId: string;
  let otherStudentUserId: string;

  let resumeAttemptId: string;

  const runId = Date.now();

  const studentEmail =
    `student-assessments-e2e-${runId}@test.com`;

  const studentPassword =
    'StudentTest123!';

  const otherStudentEmail =
    `other-student-${runId}@test.com`;

  const otherStudentPassword =
    'OtherStudent123!';

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
    // Reusable teacher.
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
    // Primary student.
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

    // ------------------------------------------------
    // Second student used for ownership tests.
    // ------------------------------------------------
    const otherPasswordHash =
      await bcrypt.hash(
        otherStudentPassword,
        12,
      );

    const otherStudent =
      await prisma.user.create({
        data: {
          firstName: 'Other',
          lastName: 'Student',
          email: otherStudentEmail,
          passwordHash:
            otherPasswordHash,
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,

          student: {
            create: {
              teacherId:
                teacherUserId,
              studentId:
                `STU-OTHER-${runId}`,
              board: 'CBSE',
              grade: '10',
              mustChangePassword:
                false,
            },
          },
        },

        select: {
          id: true,
        },
      });

    otherStudentUserId =
      otherStudent.id;

    const otherLoginResponse =
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email:
            otherStudentEmail,
          password:
            otherStudentPassword,
        })
        .expect(200);

    otherStudentToken =
      otherLoginResponse.body.accessToken;
  });

  afterAll(async () => {
    try {
      if (prisma) {
        if (
          createdAssessmentIds.length > 0
        ) {
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

        if (otherStudentUserId) {
          await prisma.user.delete({
            where: {
              id: otherStudentUserId,
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
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  // ==================================================
  // ISSUE #28 — LIST AVAILABLE ASSESSMENTS
  // ==================================================

  it('returns matching published assessment as AVAILABLE', async () => {
    const now = new Date();

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

  it('does not return assessment for another board or grade', async () => {
    const now = new Date();

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
          wrongGradeAssessmentId,
      );

    expect(
      assessment,
    ).toBeUndefined();
  });

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

  it('rejects unauthenticated access', async () => {
    await request(
      app.getHttpServer(),
    )
      .get('/student/assessments')
      .expect(401);
  });

  // ==================================================
  // ISSUE #30 — GET / RESUME ATTEMPT
  // ==================================================

  it('returns an active assessment attempt with questions and saved answers', async () => {
    const now = new Date();

    const assessmentId =
      `ASM-E2E-RESUME-${Date.now()}`;

    createdAssessmentIds.push(
      assessmentId,
    );

    const assessment =
      await prisma.assessment.create({
        data: {
          assessmentId,
          teacherId:
            teacherUserId,
          title:
            'Resume Attempt Test',
          instructions:
            'Answer all questions.',
          board: 'CBSE',
          grade: '10',
          subject: 'Science',
          durationMinutes: 60,
          maximumMarks: 7,
          startAt: new Date(
            now.getTime() -
              10 * 60 * 1000,
          ),
          endAt: new Date(
            now.getTime() +
              2 * 60 * 60 * 1000,
          ),
          status:
            AssessmentStatus.PUBLISHED,

          questions: {
            create: [
              {
                questionId:
                  `QUE-E2E-MCQ-${Date.now()}`,
                type:
                  QuestionType.MCQ,
                prompt:
                  'What is 2 + 2?',
                marks: 2,
                order: 1,
                options: [
                  {
                    id: 'A',
                    text: '3',
                  },
                  {
                    id: 'B',
                    text: '4',
                  },
                  {
                    id: 'C',
                    text: '5',
                  },
                  {
                    id: 'D',
                    text: '6',
                  },
                ],
                correctOption:
                  'B',
                explanation:
                  '2 + 2 equals 4.',
              },

              {
                questionId:
                  `QUE-E2E-TYPED-${Date.now()}`,
                type:
                  QuestionType.TYPED,
                prompt:
                  'Explain gravity.',
                marks: 5,
                order: 2,
                modelAnswer:
                  'Gravity attracts masses.',
                gradingInstructions:
                  'Check the core concept.',
              },
            ],
          },
        },

        select: {
          id: true,

          questions: {
            orderBy: {
              order: 'asc',
            },

            select: {
              id: true,
              questionId: true,
            },
          },
        },
      });

    const attempt =
      await prisma.assessmentAttempt.create({
        data: {
          attemptId:
            `ATT-E2E-${Date.now()}`,
          studentUserId,
          assessmentId:
            assessment.id,
          status:
            AssessmentAttemptStatus.IN_PROGRESS,
          startedAt: now,
          expiresAt:
            new Date(
              now.getTime() +
                60 * 60 * 1000,
            ),
        },
      });

    resumeAttemptId =
      attempt.attemptId;

    // Save only question 1.
    await prisma.studentAnswer.create({
      data: {
        attemptId:
          attempt.id,
        questionId:
          assessment.questions[0].id,
        selectedOption:
          'B',
      },
    });

    const response = await request(
      app.getHttpServer(),
    )
      .get(
        `/student/attempts/${resumeAttemptId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(200);

    expect(
      response.body.attempt.attemptId,
    ).toBe(resumeAttemptId);

    expect(
      response.body.attempt.status,
    ).toBe('IN_PROGRESS');

    expect(
      response.body.assessment
        .assessmentId,
    ).toBe(assessmentId);

    expect(
      response.body.assessment
        .instructions,
    ).toBe(
      'Answer all questions.',
    );

    expect(
      response.body.questions,
    ).toHaveLength(2);

    expect(
      response.body.questions[0]
        .answer.selectedOption,
    ).toBe('B');

    expect(
      response.body.questions[1]
        .answer,
    ).toBeNull();

    expect(
      response.body.questions[0]
        .options,
    ).toHaveLength(4);

    expect(
      response.body.questions[1]
        .options,
    ).toBeNull();
  });

  it('does not expose teacher-only question fields', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get(
        `/student/attempts/${resumeAttemptId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(200);

    for (
      const question of
      response.body.questions
    ) {
      expect(
        question,
      ).not.toHaveProperty(
        'correctOption',
      );

      expect(
        question,
      ).not.toHaveProperty(
        'modelAnswer',
      );

      expect(
        question,
      ).not.toHaveProperty(
        'gradingInstructions',
      );

      expect(
        question,
      ).not.toHaveProperty(
        'explanation',
      );
    }
  });

  it('returns 404 when another student tries to access the attempt', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        `/student/attempts/${resumeAttemptId}`,
      )
      .set(
        'Authorization',
        `Bearer ${otherStudentToken}`,
      )
      .expect(404);
  });

  it('allows the student to view a submitted attempt', async () => {
    await prisma.assessmentAttempt.update({
      where: {
        attemptId:
          resumeAttemptId,
      },

      data: {
        status:
          AssessmentAttemptStatus.SUBMITTED,
        submittedAt:
          new Date(),
      },
    });

    const response = await request(
      app.getHttpServer(),
    )
      .get(
        `/student/attempts/${resumeAttemptId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(200);

    expect(
      response.body.attempt.status,
    ).toBe('SUBMITTED');

    expect(
      response.body.attempt.submittedAt,
    ).toBeDefined();
  });

  it('rejects an expired IN_PROGRESS attempt', async () => {
    await prisma.assessmentAttempt.update({
      where: {
        attemptId:
          resumeAttemptId,
      },

      data: {
        status:
          AssessmentAttemptStatus.IN_PROGRESS,
        submittedAt:
          null,
        expiresAt:
          new Date(
            Date.now() -
              60 * 1000,
          ),
      },
    });

    await request(
      app.getHttpServer(),
    )
      .get(
        `/student/attempts/${resumeAttemptId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(409);
  });

  it('returns 404 for an unknown attempt', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        '/student/attempts/ATT-DOES-NOT-EXIST',
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(404);
  });
});