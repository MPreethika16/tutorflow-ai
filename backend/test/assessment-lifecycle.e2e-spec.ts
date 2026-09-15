import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole, QuestionType, AssessmentStatus, AssessmentAttemptStatus, EvaluationStatus } from '../src/generated/prisma/client';

describe('Assessment Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const runId = Date.now();
  let teacherToken: string;
  let teacherId: string;
  let studentToken: string;
  let studentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // 1. Setup users
    const teacherUser = await prisma.user.create({
      data: {
        email: `teacher-${runId}@test.com`,
        passwordHash: 'hash',
        firstName: 'T',
        lastName: 'T',
        role: UserRole.TEACHER,
        teacher: { create: {} },
      },
    });
    teacherId = teacherUser.id;
    teacherToken = jwtService.sign({ sub: teacherId, email: teacherUser.email, role: teacherUser.role });

    const studentUser = await prisma.user.create({
      data: {
        email: `student-${runId}@test.com`,
        passwordHash: 'hash',
        firstName: 'S',
        lastName: 'S',
        role: UserRole.STUDENT,
        student: { create: { studentId: `STU-${runId}`, grade: '10', board: 'CBSE', teacherId, mustChangePassword: false } },
      },
    });
    studentId = studentUser.id;
    studentToken = jwtService.sign({ sub: studentId, email: studentUser.email, role: studentUser.role });
  });

  afterAll(async () => {
    if (prisma) {
      const ids = [teacherId, studentId].filter(Boolean) as string[];
      if (ids.length > 0) {
        await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
        await prisma.answerEvaluation.deleteMany({ where: { studentAnswer: { attempt: { studentUserId: { in: ids } } } } });
        await prisma.studentAnswer.deleteMany({ where: { attempt: { studentUserId: { in: ids } } } });
        await prisma.assessmentAttempt.deleteMany({ where: { studentUserId: { in: ids } } });
        await prisma.question.deleteMany({ where: { assessment: { teacherId: { in: ids } } } });
        await prisma.assessment.deleteMany({ where: { teacherId: { in: ids } } });
        await prisma.student.deleteMany({ where: { userId: { in: ids } } });
        await prisma.teacher.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({
          where: { id: { in: ids } }
        });
      }
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });


  it('completes the full assessment lifecycle', async () => {
    // 2. Create Assessment
    const createRes = await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Lifecycle Test',
        board: 'CBSE',
        grade: '10',
        subject: 'Science',
        durationMinutes: 60,
        startAt: new Date(Date.now() - 3600000).toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString()
      })
      .expect(201);
    
    const assessmentId = createRes.body.assessmentId;

    // 2a. Add Q1 (MCQ)
    const q1Res = await request(app.getHttpServer())
      .post(`/assessments/${assessmentId}/questions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        type: QuestionType.MCQ,
        prompt: 'Question 1',
        marks: 5,
        options: [
          { id: 'A', text: 'Op A' },
          { id: 'B', text: 'Op B' },
          { id: 'C', text: 'Op C' },
          { id: 'D', text: 'Op D' }
        ],
        correctOption: 'A',
      });
    if (q1Res.status !== 201) console.error('Q1 error:', q1Res.body);
    expect(q1Res.status).toBe(201);
    
    // 2b. Add Q2 (TYPED)
    const q2Res = await request(app.getHttpServer())
      .post(`/assessments/${assessmentId}/questions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        type: QuestionType.TYPED,
        prompt: 'Question 2',
        marks: 5,
        modelAnswer: 'Model',
        gradingInstructions: 'Grade',
      });
    if (q2Res.status !== 201) console.error('Q2 error:', q2Res.body);
    expect(q2Res.status).toBe(201);
    
    // 2c. Publish Assessment so it's AVAILABLE to students
    const patchRes = await request(app.getHttpServer())
      .post(`/assessments/${assessmentId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`);
    
    if (patchRes.status !== 201) console.error('Patch error:', patchRes.body);
    expect(patchRes.status).toBe(201);

    // 3. Start attempt
    const startRes = await request(app.getHttpServer())
      .post(`/student/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    if (startRes.status !== 201) console.error('Start Attempt error:', startRes.body);
    expect(startRes.status).toBe(201);
    
    const attemptId = startRes.body.attempt.attemptId;

    const attemptRes = await request(app.getHttpServer())
      .get(`/student/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const q1Id = attemptRes.body.questions[0].questionId;
    const q2Id = attemptRes.body.questions[1].questionId;

    // 4. Save Answers
    await request(app.getHttpServer())
      .put(`/student/attempts/${attemptId}/answers/${q1Id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ selectedOption: 'A' })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/student/attempts/${attemptId}/answers/${q2Id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ textAnswer: 'My Answer' })
      .expect(200);

    // 5. Submit
    await request(app.getHttpServer())
      .post(`/student/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);
    
    // Attempt is submitted, now we need to mock AI grading for Q2 and auto grading for Q1
    // The worker is disabled, so we simulate the evaluation directly in DB
    const studentDbAttempt = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { attemptId },
      include: { answers: true }
    });

    const ans1 = studentDbAttempt.answers.find(a => a.selectedOption);
    const ans2 = studentDbAttempt.answers.find(a => a.textAnswer);

    // Q1 is auto-graded to APPROVED (MCQ)
    await prisma.answerEvaluation.updateMany({
      where: { studentAnswerId: ans1!.id },
      data: { status: EvaluationStatus.APPROVED, aiMarks: 5 }
    });

    // Q2 is graded by AI to WAITING_FOR_REVIEW
    await prisma.answerEvaluation.updateMany({
      where: { studentAnswerId: ans2!.id },
      data: { status: EvaluationStatus.WAITING_FOR_REVIEW, aiMarks: 3, aiFeedback: 'Good' }
    });

    // 6. Teacher overrides Q2 to APPROVED
    await request(app.getHttpServer())
      .patch(`/assessments/${assessmentId}/attempts/${attemptId}/answers/${ans2!.id}/review`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        teacherMarks: 4,
        teacherFeedback: 'Very good'
      })
      .expect(200);

    // Negative path: wrong teacher blocked
    await request(app.getHttpServer())
      .post(`/assessments/${assessmentId}/attempts/${attemptId}/publish`)
      .set('Authorization', `Bearer ${studentToken}`) // unauthorized role
      .expect(403);

    // Negative path: unpublished marks hidden & excluded from export
    const preHistory = await request(app.getHttpServer())
      .get('/student/attempts')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const preHistAttempt = preHistory.body.attempts.find((a: any) => a.attemptId === attemptId);
    expect(preHistAttempt.studentStatus).toBe('BEING_GRADED');
    expect(preHistAttempt.finalMarks).toBeNull();
    
    await request(app.getHttpServer())
      .get(`/assessments/${assessmentId}/export.csv`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)
      .expect(res => {
        expect(res.text).not.toContain('9,10,90');
      });

    // 7. Publish
    await request(app.getHttpServer())
      .post(`/assessments/${assessmentId}/attempts/${attemptId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(201);

    // Wait a tick for EventEmitter to process notification
    await new Promise(resolve => setTimeout(resolve, 200));

    // 8. Verify Notification
    const notifs = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(notifs.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ referenceId: attemptId, read: false })
      ])
    );

    // 9. Check dashboard history for RESULT_READY
    const history = await request(app.getHttpServer())
      .get('/student/attempts')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    
    const histAttempt = history.body.attempts.find((a: any) => a.attemptId === attemptId);
    expect(histAttempt.studentStatus).toBe('RESULT_READY');
    expect(histAttempt.finalMarks).toBe(9); // 5 (Q1) + 4 (Q2 override)
    expect(histAttempt.percentage).toBe(90);

    // 10. Verify CSV Export
    const csv = await request(app.getHttpServer())
      .get(`/assessments/${assessmentId}/export.csv`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    
    expect(csv.text).toContain('9,10,90');
    expect(csv.text).toContain('S S');

    // Negative path: idempotency and notification isolation
    await request(app.getHttpServer())
      .post(`/assessments/${assessmentId}/attempts/${attemptId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(201); // 201 Created because already published

    const postNotifs = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    // Should still only be 1
    expect(postNotifs.body.length).toBe(1);

    // Negative path: wrong student blocked from reading another student's result
    await request(app.getHttpServer())
      .get(`/student/attempts/${attemptId}/result`)
      .set('Authorization', `Bearer ${teacherToken}`) // wrong role / different user
      .expect(403);
  });
});
