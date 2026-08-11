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

    app =
      moduleFixture.createNestApplication();

    await app.init();

    prisma =
      app.get(PrismaService);

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

    const studentPasswordHash =
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
          passwordHash:
            studentPasswordHash,
          role: UserRole.STUDENT,
          status:
            UserStatus.ACTIVE,

          student: {
            create: {
              teacherId:
                teacherUserId,
              studentId:
                `STU-E2E-${runId}`,
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

    studentUserId =
      studentUser.id;

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
          email:
            otherStudentEmail,
          passwordHash:
            otherPasswordHash,
          role: UserRole.STUDENT,
          status:
            UserStatus.ACTIVE,

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
      await request(
        app.getHttpServer(),
      )
        .post('/auth/login')
        .send({
          email:
            otherStudentEmail,
          password:
            otherStudentPassword,
        })
        .expect(200);

    otherStudentToken =
      otherLoginResponse.body
        .accessToken;
  });

  afterAll(async () => {
    try {
      if (prisma) {
        if (
          createdAssessmentIds.length >
          0
        ) {
          await prisma.studentAnswer
            .deleteMany({
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

          await prisma.assessmentAttempt
            .deleteMany({
              where: {
                assessment: {
                  assessmentId: {
                    in: createdAssessmentIds,
                  },
                },
              },
            });

          await prisma.assessment
            .deleteMany({
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

  function uniqueId(
    prefix: string,
  ) {
    return `${prefix}-${Date.now()}-${Math.floor(
      Math.random() * 1_000_000,
    )}`;
  }

  async function createAnswerFixture(
    type: QuestionType,
    options?: {
      expired?: boolean;
      submitted?: boolean;
    },
  ) {
    const now = new Date();

    const assessmentId =
      uniqueId(
        'ASM-E2E-ANSWER',
      );

    const questionId =
      uniqueId(
        'QUE-E2E-ANSWER',
      );

    const attemptId =
      uniqueId(
        'ATT-E2E-ANSWER',
      );

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
            'Student Answer E2E Test',
          board: 'CBSE',
          grade: '10',
          subject: 'Science',
          durationMinutes: 60,
          maximumMarks: 5,

          startAt:
            new Date(
              now.getTime() -
                10 * 60 * 1000,
            ),

          endAt:
            new Date(
              now.getTime() +
                2 *
                  60 *
                  60 *
                  1000,
            ),

          status:
            AssessmentStatus.PUBLISHED,
        },

        select: {
          id: true,
          assessmentId: true,
        },
      });

    const question =
      await prisma.question.create({
        data: {
          questionId,

          assessmentId:
            assessment.id,

          type,

          prompt:
            'Answer fixture question',

          marks: 5,
          order: 1,

          options:
            type ===
            QuestionType.MCQ
              ? [
                  {
                    id: 'A',
                    text:
                      'Option A',
                  },
                  {
                    id: 'B',
                    text:
                      'Option B',
                  },
                  {
                    id: 'C',
                    text:
                      'Option C',
                  },
                  {
                    id: 'D',
                    text:
                      'Option D',
                  },
                ]
              : undefined,

          correctOption:
            type ===
            QuestionType.MCQ
              ? 'B'
              : undefined,

          modelAnswer:
            type ===
            QuestionType.MCQ
              ? undefined
              : 'Example model answer',
        },

        select: {
          id: true,
          questionId: true,
        },
      });

    const expiresAt =
      options?.expired
        ? new Date(
            now.getTime() -
              60 * 1000,
          )
        : new Date(
            now.getTime() +
              60 *
                60 *
                1000,
          );

    const submittedAt =
      options?.submitted
        ? now
        : null;

    const attempt =
      await prisma.assessmentAttempt
        .create({
          data: {
            attemptId,
            studentUserId,

            assessmentId:
              assessment.id,

            status:
              options?.submitted
                ? AssessmentAttemptStatus.SUBMITTED
                : AssessmentAttemptStatus.IN_PROGRESS,

            startedAt:
              new Date(
                now.getTime() -
                  5 *
                    60 *
                    1000,
              ),

            expiresAt,
            submittedAt,
          },

          select: {
            id: true,
            attemptId: true,
            expiresAt: true,
          },
        });

    return {
      assessment,
      question,
      attempt,
    };
  }

  async function createResumeFixture(
    options?: {
      expired?: boolean;
      submitted?: boolean;
    },
  ) {
    const now = new Date();

    const assessmentId =
      uniqueId(
        'ASM-E2E-RESUME',
      );

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

          startAt:
            new Date(
              now.getTime() -
                10 *
                  60 *
                  1000,
            ),

          endAt:
            new Date(
              now.getTime() +
                2 *
                  60 *
                  60 *
                  1000,
            ),

          status:
            AssessmentStatus.PUBLISHED,

          questions: {
            create: [
              {
                questionId:
                  uniqueId(
                    'QUE-E2E-MCQ',
                  ),

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
                  uniqueId(
                    'QUE-E2E-TYPED',
                  ),

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
          assessmentId: true,

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

    const expiresAt =
      options?.expired
        ? new Date(
            now.getTime() -
              60 * 1000,
          )
        : new Date(
            now.getTime() +
              60 *
                60 *
                1000,
          );

    const attempt =
      await prisma.assessmentAttempt
        .create({
          data: {
            attemptId:
              uniqueId(
                'ATT-E2E-RESUME',
              ),

            studentUserId,

            assessmentId:
              assessment.id,

            status:
              options?.submitted
                ? AssessmentAttemptStatus.SUBMITTED
                : AssessmentAttemptStatus.IN_PROGRESS,

            startedAt:
              new Date(
                now.getTime() -
                  5 *
                    60 *
                    1000,
              ),

            expiresAt,

            submittedAt:
              options?.submitted
                ? now
                : null,
          },

          select: {
            id: true,
            attemptId: true,
            expiresAt: true,
          },
        });

    await prisma.studentAnswer
      .create({
        data: {
          attemptId:
            attempt.id,

          questionId:
            assessment
              .questions[0].id,

          selectedOption:
            'B',
        },
      });

    return {
      assessment,
      attempt,
    };
  }

  // ==================================================
  // ISSUE #28 — LIST AVAILABLE ASSESSMENTS
  // ==================================================

  it('returns matching published assessment as AVAILABLE', async () => {
    const now =
      new Date();

    const assessmentId =
      uniqueId(
        'ASM-E2E-AVAILABLE',
      );

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId:
          teacherUserId,

        title:
          'Available E2E Assessment',

        board: 'CBSE',
        grade: '10',
        subject: 'Science',
        durationMinutes: 60,
        maximumMarks: 20,

        startAt:
          new Date(
            now.getTime() -
              60 *
                60 *
                1000,
          ),

        endAt:
          new Date(
            now.getTime() +
              60 *
                60 *
                1000,
          ),

        status:
          AssessmentStatus.PUBLISHED,
      },
    });

    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          '/student/assessments',
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .expect(200);

    const assessment =
      response.body.assessments
        .find(
          (item: {
            assessmentId: string;
          }) =>
            item.assessmentId ===
            assessmentId,
        );

    expect(
      assessment,
    ).toBeDefined();

    expect(
      assessment.attemptStatus,
    ).toBe('AVAILABLE');

    expect(
      assessment.attemptId,
    ).toBeNull();
  });

  it('does not return assessment for another board or grade', async () => {
    const now =
      new Date();

    const assessmentId =
      uniqueId(
        'ASM-E2E-WRONG-GRADE',
      );

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId:
          teacherUserId,
        title:
          'Wrong Grade Assessment',
        board: 'CBSE',
        grade: '9',
        subject: 'Science',
        durationMinutes: 60,
        maximumMarks: 20,

        startAt:
          new Date(
            now.getTime() -
              60 *
                60 *
                1000,
          ),

        endAt:
          new Date(
            now.getTime() +
              60 *
                60 *
                1000,
          ),

        status:
          AssessmentStatus.PUBLISHED,
      },
    });

    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          '/student/assessments',
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .expect(200);

    expect(
      response.body.assessments
        .some(
          (item: {
            assessmentId: string;
          }) =>
            item.assessmentId ===
            assessmentId,
        ),
    ).toBe(false);
  });

  it('rejects teacher and unauthenticated access to the student list', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        '/student/assessments',
      )
      .set(
        'Authorization',
        `Bearer ${teacherToken}`,
      )
      .expect(403);

    await request(
      app.getHttpServer(),
    )
      .get(
        '/student/assessments',
      )
      .expect(401);
  });

  // ==================================================
  // ISSUE #30 — GET / RESUME ATTEMPT
  // ==================================================

  it('returns an active attempt with safe questions and saved answers', async () => {
    const fixture =
      await createResumeFixture();

    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          `/student/attempts/${fixture.attempt.attemptId}`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .expect(200);

    expect(
      response.body.attempt.status,
    ).toBe('IN_PROGRESS');

    expect(
      response.body.questions,
    ).toHaveLength(2);

    expect(
      response.body
        .questions[0]
        .answer
        .selectedOption,
    ).toBe('B');

    expect(
      response.body
        .questions[1]
        .answer,
    ).toBeNull();

    expect(
      response.body
        .questions[0]
        .options,
    ).toEqual([
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
    ]);

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

  it('returns 404 when another student tries to read an attempt', async () => {
    const fixture =
      await createResumeFixture();

    await request(
      app.getHttpServer(),
    )
      .get(
        `/student/attempts/${fixture.attempt.attemptId}`,
      )
      .set(
        'Authorization',
        `Bearer ${otherStudentToken}`,
      )
      .expect(404);
  });

  it('allows a submitted attempt to be viewed', async () => {
    const fixture =
      await createResumeFixture({
        submitted: true,
      });

    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          `/student/attempts/${fixture.attempt.attemptId}`,
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
      response.body.attempt
        .submittedAt,
    ).toBeDefined();
  });

  it('auto-submits an expired IN_PROGRESS attempt when fetched', async () => {
    const fixture =
      await createResumeFixture({
        expired: true,
      });

    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          `/student/attempts/${fixture.attempt.attemptId}`,
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
      new Date(
        response.body.attempt
          .submittedAt,
      ).getTime(),
    ).toBe(
      fixture.attempt
        .expiresAt
        .getTime(),
    );

    const persisted =
      await prisma
        .assessmentAttempt
        .findUniqueOrThrow({
          where: {
            attemptId:
              fixture.attempt
                .attemptId,
          },

          select: {
            status: true,
            submittedAt: true,
          },
        });

    expect(
      persisted.status,
    ).toBe(
      AssessmentAttemptStatus.SUBMITTED,
    );

    expect(
      persisted.submittedAt
        ?.getTime(),
    ).toBe(
      fixture.attempt
        .expiresAt
        .getTime(),
    );
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

  // ==================================================
  // ISSUE #31 — SAVE / UPDATE STUDENT ANSWERS
  // ==================================================

  it('creates and updates an MCQ answer case-insensitively without duplicates', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.MCQ,
      );

    const first =
      await request(
        app.getHttpServer(),
      )
        .put(
          `/student/attempts/${fixture.attempt.attemptId}/answers/${fixture.question.questionId}`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .send({
          selectedOption: 'a',
        })
        .expect(200);

    expect(
      first.body.answer
        .selectedOption,
    ).toBe('A');

    const second =
      await request(
        app.getHttpServer(),
      )
        .put(
          `/student/attempts/${fixture.attempt.attemptId}/answers/${fixture.question.questionId}`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .send({
          selectedOption: 'b',
        })
        .expect(200);

    expect(
      second.body.answer
        .selectedOption,
    ).toBe('B');

    const count =
      await prisma.studentAnswer
        .count({
          where: {
            attemptId:
              fixture.attempt.id,
            questionId:
              fixture.question.id,
          },
        });

    expect(count).toBe(1);
  });

  it('clears an MCQ selection when selectedOption is null', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.MCQ,
      );

    await request(
      app.getHttpServer(),
    )
      .put(
        `/student/attempts/${fixture.attempt.attemptId}/answers/${fixture.question.questionId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .send({
        selectedOption: 'B',
      })
      .expect(200);

    const response =
      await request(
        app.getHttpServer(),
      )
        .put(
          `/student/attempts/${fixture.attempt.attemptId}/answers/${fixture.question.questionId}`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .send({
          selectedOption: null,
        })
        .expect(200);

    expect(
      response.body.answer
        .selectedOption,
    ).toBeNull();
  });

  it('saves typed and voice answers', async () => {
    const typed =
      await createAnswerFixture(
        QuestionType.TYPED,
      );

    const typedResponse =
      await request(
        app.getHttpServer(),
      )
        .put(
          `/student/attempts/${typed.attempt.attemptId}/answers/${typed.question.questionId}`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .send({
          textAnswer:
            'Gravity attracts objects with mass.',
        })
        .expect(200);

    expect(
      typedResponse.body.answer
        .textAnswer,
    ).toBe(
      'Gravity attracts objects with mass.',
    );

    const voice =
      await createAnswerFixture(
        QuestionType.VOICE,
      );

    const voiceResponse =
      await request(
        app.getHttpServer(),
      )
        .put(
          `/student/attempts/${voice.attempt.attemptId}/answers/${voice.question.questionId}`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .send({
          voiceUrl:
            'https://example.com/audio/answer.webm',
        })
        .expect(200);

    expect(
      voiceResponse.body.answer
        .voiceUrl,
    ).toBe(
      'https://example.com/audio/answer.webm',
    );
  });

  it('rejects invalid MCQ options and wrong answer shapes', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.MCQ,
      );

    await request(
      app.getHttpServer(),
    )
      .put(
        `/student/attempts/${fixture.attempt.attemptId}/answers/${fixture.question.questionId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .send({
        selectedOption: 'Z',
      })
      .expect(400);

    await request(
      app.getHttpServer(),
    )
      .put(
        `/student/attempts/${fixture.attempt.attemptId}/answers/${fixture.question.questionId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .send({
        textAnswer:
          'Not an MCQ answer.',
      })
      .expect(400);
  });

  it('protects answer ownership and question ownership', async () => {
    const first =
      await createAnswerFixture(
        QuestionType.TYPED,
      );

    const second =
      await createAnswerFixture(
        QuestionType.TYPED,
      );

    await request(
      app.getHttpServer(),
    )
      .put(
        `/student/attempts/${first.attempt.attemptId}/answers/${first.question.questionId}`,
      )
      .set(
        'Authorization',
        `Bearer ${otherStudentToken}`,
      )
      .send({
        textAnswer:
          'Not my attempt.',
      })
      .expect(404);

    await request(
      app.getHttpServer(),
    )
      .put(
        `/student/attempts/${first.attempt.attemptId}/answers/${second.question.questionId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .send({
        textAnswer:
          'Wrong assessment.',
      })
      .expect(404);
  });

  it('rejects answer changes after submission', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.TYPED,
        {
          submitted: true,
        },
      );

    await request(
      app.getHttpServer(),
    )
      .put(
        `/student/attempts/${fixture.attempt.attemptId}/answers/${fixture.question.questionId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .send({
        textAnswer:
          'Too late.',
      })
      .expect(409);
  });

  it('auto-submits an expired attempt before rejecting a late answer', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.TYPED,
        {
          expired: true,
        },
      );

    await request(
      app.getHttpServer(),
    )
      .put(
        `/student/attempts/${fixture.attempt.attemptId}/answers/${fixture.question.questionId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .send({
        textAnswer:
          'Too late.',
      })
      .expect(409);

    const persisted =
      await prisma
        .assessmentAttempt
        .findUniqueOrThrow({
          where: {
            attemptId:
              fixture.attempt
                .attemptId,
          },

          select: {
            status: true,
            submittedAt: true,
          },
        });

    expect(
      persisted.status,
    ).toBe(
      AssessmentAttemptStatus.SUBMITTED,
    );

    expect(
      persisted.submittedAt
        ?.getTime(),
    ).toBe(
      fixture.attempt
        .expiresAt
        .getTime(),
    );
  });

  it('rejects unauthenticated answer saves', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.TYPED,
      );

    await request(
      app.getHttpServer(),
    )
      .put(
        `/student/attempts/${fixture.attempt.attemptId}/answers/${fixture.question.questionId}`,
      )
      .send({
        textAnswer:
          'No token.',
      })
      .expect(401);
  });

  // ==================================================
  // ISSUE #32 — SUBMIT ASSESSMENT ATTEMPT
  // ==================================================

  it('submits an active attempt and returns correct answer counts', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.TYPED,
      );

    await prisma.studentAnswer
      .create({
        data: {
          attemptId:
            fixture.attempt.id,

          questionId:
            fixture.question.id,

          textAnswer:
            'My final answer.',
        },
      });

    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          `/student/attempts/${fixture.attempt.attemptId}/submit`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .expect(201);

    expect(
      response.body.attempt.status,
    ).toBe('SUBMITTED');

    expect(
      response.body
        .answeredQuestions,
    ).toBe(1);

    expect(
      response.body
        .totalQuestions,
    ).toBe(1);
  });

  it('allows submission with unanswered questions', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.TYPED,
      );

    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          `/student/attempts/${fixture.attempt.attemptId}/submit`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .expect(201);

    expect(
      response.body
        .answeredQuestions,
    ).toBe(0);

    expect(
      response.body
        .totalQuestions,
    ).toBe(1);
  });

  it('rejects submitting the same active attempt twice', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.TYPED,
      );

    await request(
      app.getHttpServer(),
    )
      .post(
        `/student/attempts/${fixture.attempt.attemptId}/submit`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(201);

    await request(
      app.getHttpServer(),
    )
      .post(
        `/student/attempts/${fixture.attempt.attemptId}/submit`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(409);
  });

  it('auto-submits an expired attempt when submit is called', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.TYPED,
        {
          expired: true,
        },
      );

    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          `/student/attempts/${fixture.attempt.attemptId}/submit`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .expect(201);

    expect(
      response.body.attempt.status,
    ).toBe('SUBMITTED');

    expect(
      new Date(
        response.body.attempt
          .submittedAt,
      ).getTime(),
    ).toBe(
      fixture.attempt
        .expiresAt
        .getTime(),
    );

    const persisted =
      await prisma
        .assessmentAttempt
        .findUniqueOrThrow({
          where: {
            attemptId:
              fixture.attempt
                .attemptId,
          },

          select: {
            status: true,
            submittedAt: true,
          },
        });

    expect(
      persisted.status,
    ).toBe(
      AssessmentAttemptStatus.SUBMITTED,
    );

    expect(
      persisted.submittedAt
        ?.getTime(),
    ).toBe(
      fixture.attempt
        .expiresAt
        .getTime(),
    );
  });

  it('returns 404 when another student tries to submit an attempt', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.TYPED,
      );

    await request(
      app.getHttpServer(),
    )
      .post(
        `/student/attempts/${fixture.attempt.attemptId}/submit`,
      )
      .set(
        'Authorization',
        `Bearer ${otherStudentToken}`,
      )
      .expect(404);
  });

  it('returns 404 for an unknown submit attempt and 401 without auth', async () => {
    await request(
      app.getHttpServer(),
    )
      .post(
        '/student/attempts/ATT-DOES-NOT-EXIST/submit',
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(404);

    const fixture =
      await createAnswerFixture(
        QuestionType.TYPED,
      );

    await request(
      app.getHttpServer(),
    )
      .post(
        `/student/attempts/${fixture.attempt.attemptId}/submit`,
      )
      .expect(401);
  });

  it('prevents answers from changing after submission', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.TYPED,
      );

    await request(
      app.getHttpServer(),
    )
      .put(
        `/student/attempts/${fixture.attempt.attemptId}/answers/${fixture.question.questionId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .send({
        textAnswer:
          'Answer before submit.',
      })
      .expect(200);

    await request(
      app.getHttpServer(),
    )
      .post(
        `/student/attempts/${fixture.attempt.attemptId}/submit`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .expect(201);

    await request(
      app.getHttpServer(),
    )
      .put(
        `/student/attempts/${fixture.attempt.attemptId}/answers/${fixture.question.questionId}`,
      )
      .set(
        'Authorization',
        `Bearer ${studentToken}`,
      )
      .send({
        textAnswer:
          'Changed after submit.',
      })
      .expect(409);

    const saved =
      await prisma.studentAnswer
        .findUniqueOrThrow({
          where: {
            attemptId_questionId: {
              attemptId:
                fixture.attempt.id,

              questionId:
                fixture.question.id,
            },
          },

          select: {
            textAnswer: true,
          },
        });

    expect(
      saved.textAnswer,
    ).toBe(
      'Answer before submit.',
    );
  });

  // ==================================================
  // ISSUE #33 — ENFORCE ASSESSMENT TIMING / ATTEMPT STATE
  // ==================================================

  it('rejects starting an assessment before startAt', async () => {
    const now =
      new Date();

    const assessmentId =
      uniqueId(
        'ASM-E2E-UPCOMING',
      );

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId:
          teacherUserId,

        title:
          'Upcoming Timing Test',

        board: 'CBSE',
        grade: '10',
        subject: 'Science',

        durationMinutes: 30,
        maximumMarks: 5,

        startAt:
          new Date(
            now.getTime() +
              30 * 60 * 1000,
          ),

        endAt:
          new Date(
            now.getTime() +
              2 * 60 * 60 * 1000,
          ),

        status:
          AssessmentStatus.PUBLISHED,

        questions: {
          create: {
            questionId:
              uniqueId(
                'QUE-E2E-UPCOMING',
              ),

            type:
              QuestionType.TYPED,

            prompt:
              'Upcoming timing question',

            marks: 5,
            order: 1,

            modelAnswer:
              'Example answer.',
          },
        },
      },
    });

    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          `/student/assessments/${assessmentId}/start`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .expect(409);

    expect(
      response.body.message,
    ).toBe(
      'Assessment has not started yet',
    );
  });

  it('rejects starting an assessment after endAt', async () => {
    const now =
      new Date();

    const assessmentId =
      uniqueId(
        'ASM-E2E-ENDED',
      );

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId:
          teacherUserId,

        title:
          'Ended Timing Test',

        board: 'CBSE',
        grade: '10',
        subject: 'Science',

        durationMinutes: 30,
        maximumMarks: 5,

        startAt:
          new Date(
            now.getTime() -
              2 * 60 * 60 * 1000,
          ),

        endAt:
          new Date(
            now.getTime() -
              60 * 1000,
          ),

        status:
          AssessmentStatus.PUBLISHED,

        questions: {
          create: {
            questionId:
              uniqueId(
                'QUE-E2E-ENDED',
              ),

            type:
              QuestionType.TYPED,

            prompt:
              'Ended timing question',

            marks: 5,
            order: 1,

            modelAnswer:
              'Example answer.',
          },
        },
      },
    });

    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          `/student/assessments/${assessmentId}/start`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .expect(409);

    expect(
      response.body.message,
    ).toBe(
      'Assessment has expired',
    );
  });

  it('sets expiresAt from durationMinutes when duration ends before assessment endAt', async () => {
    const now =
      new Date();

    const assessmentId =
      uniqueId(
        'ASM-E2E-DURATION',
      );

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId:
          teacherUserId,

        title:
          'Duration Timing Test',

        board: 'CBSE',
        grade: '10',
        subject: 'Science',

        durationMinutes: 30,
        maximumMarks: 5,

        startAt:
          new Date(
            now.getTime() -
              10 * 60 * 1000,
          ),

        endAt:
          new Date(
            now.getTime() +
              2 * 60 * 60 * 1000,
          ),

        status:
          AssessmentStatus.PUBLISHED,

        questions: {
          create: {
            questionId:
              uniqueId(
                'QUE-E2E-DURATION',
              ),

            type:
              QuestionType.TYPED,

            prompt:
              'Duration timing question',

            marks: 5,
            order: 1,

            modelAnswer:
              'Example answer.',
          },
        },
      },
    });

    const response =
      await request(
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

    const startedAt =
      new Date(
        response.body.attempt
          .startedAt,
      );

    const expiresAt =
      new Date(
        response.body.attempt
          .expiresAt,
      );

    expect(
      expiresAt.getTime() -
        startedAt.getTime(),
    ).toBe(
      30 * 60 * 1000,
    );
  });

  it('uses assessment endAt as expiresAt when durationMinutes is null', async () => {
    const now =
      new Date();

    const endAt =
      new Date(
        now.getTime() +
          90 * 60 * 1000,
      );

    const assessmentId =
      uniqueId(
        'ASM-E2E-NO-DURATION',
      );

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId:
          teacherUserId,

        title:
          'No Duration Timing Test',

        board: 'CBSE',
        grade: '10',
        subject: 'Science',

        durationMinutes: null,
        maximumMarks: 5,

        startAt:
          new Date(
            now.getTime() -
              10 * 60 * 1000,
          ),

        endAt,

        status:
          AssessmentStatus.PUBLISHED,

        questions: {
          create: {
            questionId:
              uniqueId(
                'QUE-E2E-NO-DURATION',
              ),

            type:
              QuestionType.TYPED,

            prompt:
              'No duration timing question',

            marks: 5,
            order: 1,

            modelAnswer:
              'Example answer.',
          },
        },
      },
    });

    const response =
      await request(
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

    expect(
      new Date(
        response.body.attempt
          .expiresAt,
      ).getTime(),
    ).toBe(
      endAt.getTime(),
    );
  });

  it('caps expiresAt at assessment endAt when duration would run longer', async () => {
    const now =
      new Date();

    const endAt =
      new Date(
        now.getTime() +
          5 * 60 * 1000,
      );

    const assessmentId =
      uniqueId(
        'ASM-E2E-CAPPED-DURATION',
      );

    createdAssessmentIds.push(
      assessmentId,
    );

    await prisma.assessment.create({
      data: {
        assessmentId,
        teacherId:
          teacherUserId,

        title:
          'Capped Duration Timing Test',

        board: 'CBSE',
        grade: '10',
        subject: 'Science',

        durationMinutes: 60,
        maximumMarks: 5,

        startAt:
          new Date(
            now.getTime() -
              10 * 60 * 1000,
          ),

        endAt,

        status:
          AssessmentStatus.PUBLISHED,

        questions: {
          create: {
            questionId:
              uniqueId(
                'QUE-E2E-CAPPED',
              ),

            type:
              QuestionType.TYPED,

            prompt:
              'Capped duration timing question',

            marks: 5,
            order: 1,

            modelAnswer:
              'Example answer.',
          },
        },
      },
    });

    const response =
      await request(
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

    expect(
      new Date(
        response.body.attempt
          .expiresAt,
      ).getTime(),
    ).toBe(
      endAt.getTime(),
    );
  });

  it('does not allow an auto-submitted expired attempt to be restarted', async () => {
    const fixture =
      await createAnswerFixture(
        QuestionType.TYPED,
        {
          expired: true,
        },
      );

    // Reading the expired attempt performs the automatic
    // IN_PROGRESS -> SUBMITTED transition.
    const resumeResponse =
      await request(
        app.getHttpServer(),
      )
        .get(
          `/student/attempts/${fixture.attempt.attemptId}`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .expect(200);

    expect(
      resumeResponse.body.attempt
        .status,
    ).toBe('SUBMITTED');

    const restartResponse =
      await request(
        app.getHttpServer(),
      )
        .post(
          `/student/assessments/${fixture.assessment.assessmentId}/start`,
        )
        .set(
          'Authorization',
          `Bearer ${studentToken}`,
        )
        .expect(409);

    expect(
      restartResponse.body.message,
    ).toBe(
      'Assessment already attempted',
    );

    const persisted =
      await prisma
        .assessmentAttempt
        .findUniqueOrThrow({
          where: {
            attemptId:
              fixture.attempt
                .attemptId,
          },

          select: {
            status: true,
            submittedAt: true,
          },
        });

    expect(
      persisted.status,
    ).toBe(
      AssessmentAttemptStatus.SUBMITTED,
    );

    expect(
      persisted.submittedAt
        ?.getTime(),
    ).toBe(
      fixture.attempt
        .expiresAt
        .getTime(),
    );
  });

});