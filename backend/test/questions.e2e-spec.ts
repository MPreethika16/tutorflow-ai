import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { seedTestTeacher } from './utils/seed-test-teacher';

describe('Questions API (e2e)', () => {
  let app: INestApplication;
  let teacherToken: string;
  let assessmentId: string;
  let mcqQuestionId: string;
  let typedQuestionId: string;
  let voiceQuestionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();

    // Ensure the test teacher exists in tutorflow_test_db.
    await seedTestTeacher(app);

    // Login once and reuse the JWT for all question tests.
    const loginResponse = await request(
      app.getHttpServer(),
    )
      .post('/auth/login')
      .send({
        email: process.env.TEST_TEACHER_EMAIL,
        password: process.env.TEST_TEACHER_PASSWORD,
      })
      .expect(200);

    teacherToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a draft assessment for question tests', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .post('/assessments')
      .set(
        'Authorization',
        `Bearer ${teacherToken}`,
      )
      .send({
        title: `Question E2E Assessment ${Date.now()}`,
        description:
          'Assessment created automatically for question E2E tests',
        board: 'CBSE',
        grade: '10',
        subject: 'Science',
        durationMinutes: 60,
        startAt: '2026-12-01T10:00:00.000Z',
        endAt: '2026-12-01T12:00:00.000Z',
        instructions: 'Answer every question.',
      });

    expect(response.status).toBe(201);

    assessmentId =
      response.body.assessmentId ??
      response.body.assessment?.assessmentId;

    expect(assessmentId).toBeDefined();

    expect(
      response.body.status ??
        response.body.assessment?.status,
    ).toBe('DRAFT');
  });

  it('creates an MCQ question', async () => {
  const response = await request(
    app.getHttpServer(),
  )
    .post(
      `/assessments/${assessmentId}/questions`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .send({
      type: 'MCQ',
      prompt: 'What is the capital of India?',
      marks: 2,
      options: [
        {
          id: 'A',
          text: 'Delhi',
        },
        {
          id: 'B',
          text: 'Mumbai',
        },
        {
          id: 'C',
          text: 'Chennai',
        },
        {
          id: 'D',
          text: 'Kolkata',
        },
      ],
      correctOption: 'A',
      explanation:
        'Delhi is the capital of India.',
    });

  expect(response.status).toBe(201);

  expect(response.body.question).toBeDefined();

  expect(response.body.question.type).toBe(
    'MCQ',
  );

  expect(response.body.question.prompt).toBe(
    'What is the capital of India?',
  );

  expect(response.body.question.marks).toBe(2);

  expect(response.body.question.order).toBe(1);

  expect(response.body.question.options).toHaveLength(
    4,
  );

  expect(
    response.body.question.correctOption,
  ).toBe('A');

  // Save it for get/update/reorder/delete tests later.
  mcqQuestionId =
    response.body.question.questionId;

  expect(mcqQuestionId).toBeDefined();

  // The first question is worth 2 marks,
  // so assessment.maximumMarks should now be 2.
  expect(
    response.body.assessment.maximumMarks,
  ).toBe(2);
});

    it('creates a TYPED question', async () => {
  const response = await request(
    app.getHttpServer(),
  )
    .post(
      `/assessments/${assessmentId}/questions`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .send({
      type: 'TYPED',
      prompt: "Explain Newton's second law.",
      marks: 5,
      modelAnswer:
        'Force equals mass multiplied by acceleration.',
      gradingInstructions:
        'Award marks for formula, explanation, and example.',
    });

  expect(response.status).toBe(201);

  typedQuestionId =
    response.body.question.questionId;

  expect(typedQuestionId).toBeDefined();

  expect(response.body.question.type).toBe(
    'TYPED',
  );

  expect(response.body.question.order).toBe(2);

  // 2 + 5
  expect(
    response.body.assessment.maximumMarks,
  ).toBe(7);
});

it('creates a VOICE question', async () => {
  const response = await request(
    app.getHttpServer(),
  )
    .post(
      `/assessments/${assessmentId}/questions`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .send({
      type: 'VOICE',
      prompt:
        'Explain photosynthesis in your own words.',
      marks: 5,
      modelAnswer:
        'Photosynthesis is the process by which plants use light energy to produce glucose from carbon dioxide and water.',
      gradingInstructions:
        'Check for light, carbon dioxide, water, and glucose.',
    });

  expect(response.status).toBe(201);

  voiceQuestionId =
    response.body.question.questionId;

  expect(voiceQuestionId).toBeDefined();

  expect(response.body.question.type).toBe(
    'VOICE',
  );

  expect(response.body.question.order).toBe(3);

  // 2 + 5 + 5
  expect(
    response.body.assessment.maximumMarks,
  ).toBe(12);
});

it('lists all questions in saved order', async () => {
  const response = await request(
    app.getHttpServer(),
  )
    .get(
      `/assessments/${assessmentId}/questions`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .expect(200);

  expect(response.body.questions).toHaveLength(3);

  expect(response.body.questions[0].questionId).toBe(
    mcqQuestionId,
  );

  expect(response.body.questions[1].questionId).toBe(
    typedQuestionId,
  );

  expect(response.body.questions[2].questionId).toBe(
    voiceQuestionId,
  );

  expect(response.body.questions[0].order).toBe(1);
  expect(response.body.questions[1].order).toBe(2);
  expect(response.body.questions[2].order).toBe(3);
});

it('gets one question by questionId', async () => {
  const response = await request(
    app.getHttpServer(),
  )
    .get(
      `/assessments/${assessmentId}/questions/${mcqQuestionId}`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .expect(200);

  expect(response.body.question).toBeDefined();

  expect(response.body.question.questionId).toBe(
    mcqQuestionId,
  );

  expect(response.body.question.type).toBe('MCQ');

  expect(response.body.question.prompt).toBe(
    'What is the capital of India?',
  );

  expect(response.body.question.marks).toBe(2);
});

it('updates a question and recalculates maximumMarks', async () => {
  const response = await request(
    app.getHttpServer(),
  )
    .patch(
      `/assessments/${assessmentId}/questions/${typedQuestionId}`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .send({
      prompt:
        "Explain Newton's second law with an example.",
      marks: 6,
    })
    .expect(200);

  expect(response.body.question.questionId).toBe(
    typedQuestionId,
  );

  expect(response.body.question.prompt).toBe(
    "Explain Newton's second law with an example.",
  );

  expect(response.body.question.marks).toBe(6);

  // Before:
  // MCQ   = 2
  // TYPED = 5
  // VOICE = 5
  // Total = 12
  //
  // After typed marks change to 6:
  // 2 + 6 + 5 = 13
  expect(
    response.body.assessment.maximumMarks,
  ).toBe(13);
});

it('returns 404 when updating an unknown question', async () => {
  await request(app.getHttpServer())
    .patch(
      `/assessments/${assessmentId}/questions/QUE-UNKNOWN123`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .send({
      prompt: 'Updated prompt',
    })
    .expect(404);
});

it('reorders all questions successfully', async () => {
  const response = await request(
    app.getHttpServer(),
  )
    .patch(
      `/assessments/${assessmentId}/questions/reorder`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .send({
      questions: [
        {
          questionId: voiceQuestionId,
          order: 1,
        },
        {
          questionId: mcqQuestionId,
          order: 2,
        },
        {
          questionId: typedQuestionId,
          order: 3,
        },
      ],
    })
    .expect(200);

  expect(response.body.message).toBe(
    'Questions reordered successfully',
  );

  expect(response.body.questions).toHaveLength(3);

  expect(response.body.questions[0].questionId).toBe(
    voiceQuestionId,
  );

  expect(response.body.questions[0].order).toBe(1);

  expect(response.body.questions[1].questionId).toBe(
    mcqQuestionId,
  );

  expect(response.body.questions[1].order).toBe(2);

  expect(response.body.questions[2].questionId).toBe(
    typedQuestionId,
  );

  expect(response.body.questions[2].order).toBe(3);
});

it('rejects duplicate reorder values', async () => {
  await request(app.getHttpServer())
    .patch(
      `/assessments/${assessmentId}/questions/reorder`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .send({
      questions: [
        {
          questionId: voiceQuestionId,
          order: 1,
        },
        {
          questionId: mcqQuestionId,
          order: 1,
        },
        {
          questionId: typedQuestionId,
          order: 3,
        },
      ],
    })
    .expect(400);
});

it('rejects reorder when not all questions are included', async () => {
  await request(app.getHttpServer())
    .patch(
      `/assessments/${assessmentId}/questions/reorder`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .send({
      questions: [
        {
          questionId: voiceQuestionId,
          order: 1,
        },
        {
          questionId: mcqQuestionId,
          order: 2,
        },
      ],
    })
    .expect(400);
});

it('deletes a question, reorders remaining questions, and recalculates maximumMarks', async () => {
  const response = await request(
    app.getHttpServer(),
  )
    .delete(
      `/assessments/${assessmentId}/questions/${mcqQuestionId}`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .expect(200);

  expect(response.body.message).toBe(
    'Question deleted successfully',
  );

  expect(response.body.deletedQuestionId).toBe(
    mcqQuestionId,
  );

  // Current marks:
  // TYPED = 6
  // VOICE = 5
  // Total = 11
  expect(response.body.maximumMarks).toBe(11);
});

it('keeps remaining question orders sequential after deletion', async () => {
  const response = await request(
    app.getHttpServer(),
  )
    .get(
      `/assessments/${assessmentId}/questions`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .expect(200);

  expect(response.body.questions).toHaveLength(2);

  expect(response.body.questions[0].questionId).toBe(
    voiceQuestionId,
  );

  expect(response.body.questions[0].order).toBe(1);

  expect(response.body.questions[1].questionId).toBe(
    typedQuestionId,
  );

  expect(response.body.questions[1].order).toBe(2);
});

it('returns 404 when deleting an unknown question', async () => {
  await request(app.getHttpServer())
    .delete(
      `/assessments/${assessmentId}/questions/QUE-UNKNOWN123`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .expect(404);
});

it('publishes the assessment successfully', async () => {
  const response = await request(
    app.getHttpServer(),
  )
    .post(
      `/assessments/${assessmentId}/publish`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .expect(201);

  expect(response.body.status).toBe(
    'PUBLISHED',
  );
});

it('rejects creating a question after publish', async () => {
  await request(app.getHttpServer())
    .post(
      `/assessments/${assessmentId}/questions`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .send({
      type: 'TYPED',
      prompt: 'This should not be created.',
      marks: 2,
      modelAnswer:
        'This should never be saved.',
    })
    .expect(409);
});

it('rejects updating a question after publish', async () => {
  await request(app.getHttpServer())
    .patch(
      `/assessments/${assessmentId}/questions/${typedQuestionId}`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .send({
      prompt:
        'This update should not be allowed.',
    })
    .expect(409);
});

it('rejects deleting a question after publish', async () => {
  await request(app.getHttpServer())
    .delete(
      `/assessments/${assessmentId}/questions/${typedQuestionId}`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .expect(409);
});

it('rejects reordering questions after publish', async () => {
  await request(app.getHttpServer())
    .patch(
      `/assessments/${assessmentId}/questions/reorder`,
    )
    .set(
      'Authorization',
      `Bearer ${teacherToken}`,
    )
    .send({
      questions: [
        {
          questionId: voiceQuestionId,
          order: 1,
        },
        {
          questionId: typedQuestionId,
          order: 2,
        },
      ],
    })
    .expect(409);
});
});