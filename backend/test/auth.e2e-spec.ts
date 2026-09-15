import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole, UserStatus } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedTestTeacher } from './utils/seed-test-teacher';

describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacherUserId: string;
  let teacherToken: string;
  let teacherCookie: string;

  const testStudentId = 'STU-AUTH-E2E-1';
  const testStudentPassword = 'StudentPass123!';
  let studentUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    // 1. Seed teacher
    const teacher = await seedTestTeacher(app);
    teacherUserId = teacher.id;

    // 2. Clean up any existing test student and create fresh
    const existingStudent = await prisma.student.findUnique({
      where: { studentId: testStudentId },
    });
    if (existingStudent) {
      await prisma.student.delete({ where: { studentId: testStudentId } });
      await prisma.user.delete({ where: { id: existingStudent.userId } });
    }

    const studentPasswordHash = await bcrypt.hash(testStudentPassword, 12);
    const studentUser = await prisma.user.create({
      data: {
        firstName: 'E2E',
        lastName: 'Student',
        email: null,
        passwordHash: studentPasswordHash,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        student: {
          create: {
            studentId: testStudentId,
            board: 'CBSE',
            grade: '10',
            teacherId: teacherUserId,
          },
        },
      },
    });
    studentUserId = studentUser.id;
  });

  afterAll(async () => {
    if (prisma) {
      if (studentUserId) {
        await prisma.student.deleteMany({ where: { studentId: testStudentId } });
        await prisma.user.deleteMany({ where: { id: studentUserId } });
      }
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  it('teacher login still works', async () => {
    // Test with legacy { email, password }
    const resEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.TEST_TEACHER_EMAIL,
        password: process.env.TEST_TEACHER_PASSWORD,
      });

    expect(resEmail.status).toBe(200);
    expect(resEmail.body).toHaveProperty('accessToken');
    expect(resEmail.body.user.email).toBe(
      process.env.TEST_TEACHER_EMAIL?.trim().toLowerCase(),
    );

    // Test with new unified { identifier, password }
    const resIdentifier = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: process.env.TEST_TEACHER_EMAIL,
        password: process.env.TEST_TEACHER_PASSWORD,
      });

    expect(resIdentifier.status).toBe(200);
    expect(resIdentifier.body).toHaveProperty('accessToken');
    teacherToken = resIdentifier.body.accessToken;

    const setCookie = resIdentifier.headers['set-cookie'] as unknown as string[] | undefined;
    expect(setCookie).toBeDefined();
    const cookie = setCookie!.find((c) => c.startsWith('access_token='));
    expect(cookie).toBeDefined();
    teacherCookie = cookie!.split(';')[0];
  });

  it('student login works', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: testStudentId,
        password: testStudentPassword,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.user.role).toBe(UserRole.STUDENT);
    expect(response.body.user.id).toBe(studentUserId);
  });

  it('login sets HttpOnly access_token cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: testStudentId,
        password: testStudentPassword,
      });

    expect(response.status).toBe(200);
    const setCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
    expect(setCookie).toBeDefined();

    const accessTokenCookie = setCookie!.find((c) => c.startsWith('access_token='));
    expect(accessTokenCookie).toBeDefined();
    expect(accessTokenCookie).toMatch(/HttpOnly/i);
    expect(accessTokenCookie).toMatch(/SameSite=Lax/i);
    expect(accessTokenCookie).toMatch(/Path=\//);
    expect(accessTokenCookie).toMatch(/Max-Age=\d+/);
  });

  it('cookie authenticates GET /auth/me', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', teacherCookie);

    expect(response.status).toBe(200);
    expect(response.body.sub).toBe(teacherUserId);
    expect(response.body.role).toBe(UserRole.TEACHER);
    expect(response.body.email).toBe(
      process.env.TEST_TEACHER_EMAIL?.trim().toLowerCase(),
    );
  });

  it('Bearer still authenticates GET /auth/me', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(200);
    expect(response.body.sub).toBe(teacherUserId);
    expect(response.body.role).toBe(UserRole.TEACHER);
    expect(response.body.email).toBe(
      process.env.TEST_TEACHER_EMAIL?.trim().toLowerCase(),
    );
  });

  it('invalid credentials return 401', async () => {
    // Wrong teacher password
    const res1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: process.env.TEST_TEACHER_EMAIL,
        password: 'IncorrectPassword999!',
      });
    expect(res1.status).toBe(401);
    expect(res1.body.message).toBe('Invalid identifier or password');

    // Non-existent email
    const res2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'nonexistent-user@example.com',
        password: 'SomePassword123!',
      });
    expect(res2.status).toBe(401);
    expect(res2.body.message).toBe('Invalid identifier or password');

    // Non-existent studentId
    const res3 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'STU-DOESNOTEXIST-999',
        password: 'SomePassword123!',
      });
    expect(res3.status).toBe(401);
    expect(res3.body.message).toBe('Invalid identifier or password');
  });

  it('logout clears cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Logged out successfully',
    });

    const setCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
    expect(setCookie).toBeDefined();

    const clearedCookie = setCookie!.find((c) => c.startsWith('access_token='));
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie).toMatch(/HttpOnly/i);
    expect(clearedCookie).toMatch(/SameSite=Lax/i);
    expect(clearedCookie).toMatch(/Path=\//);
    // Express clearCookie expires the cookie in the past or sets Max-Age=0
    expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
  });

  describe('Change Password Flow (E2E)', () => {
    it('unauthenticated change-password is rejected with 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .send({
          currentPassword: 'anyPassword123',
          newPassword: 'newPassword123',
        });

      expect(response.status).toBe(401);
    });

    it('student logs in with temp password, sees mustChangePassword: true, changes password, and verifies new password', async () => {
      // 1. Student logs in with initial temporary password
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: testStudentId,
          password: testStudentPassword,
        });

      expect(loginRes.status).toBe(200);
      const studentToken = loginRes.body.accessToken;
      expect(loginRes.body.expiresIn).toBe(900);
      expect(loginRes.body.user.mustChangePassword).toBe(true);

      // 2. Forced-change student is blocked (403 Forbidden) from normal student domain APIs
      const blockedAssessmentsRes = await request(app.getHttpServer())
        .get('/student/assessments')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(blockedAssessmentsRes.status).toBe(403);
      expect(blockedAssessmentsRes.body.message).toBe(
        'Password change required before accessing this resource',
      );

      // 3. Forced-change student is blocked (403 Forbidden) from notifications domain API
      const blockedNotificationsRes = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(blockedNotificationsRes.status).toBe(403);
      expect(blockedNotificationsRes.body.message).toBe(
        'Password change required before accessing this resource',
      );

      // 4. Teacher is unaffected and can access domain APIs
      const teacherNotificationsRes = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(teacherNotificationsRes.status).toBe(200);

      // 5. /auth/me still works and reports mustChangePassword: true
      const meResBefore = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(meResBefore.status).toBe(200);
      expect(meResBefore.body.mustChangePassword).toBe(true);

      // 6. Reject wrong current password
      const wrongPwdRes = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentPassword: 'wrongPassword123',
          newPassword: 'validNewPassword456',
        });
      expect(wrongPwdRes.status).toBe(401);

      // 7. Change password succeeds
      const newPassword = 'validNewPassword456';
      const changeRes = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentPassword: testStudentPassword,
          newPassword,
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // 8. /auth/me now reports mustChangePassword: false
      const meResAfter = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(meResAfter.status).toBe(200);
      expect(meResAfter.body.mustChangePassword).toBe(false);

      // 9. After password change, student can now access student domain APIs
      const allowedAssessmentsRes = await request(app.getHttpServer())
        .get('/student/assessments')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(allowedAssessmentsRes.status).toBe(200);

      const allowedNotificationsRes = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(allowedNotificationsRes.status).toBe(200);

      // 10. Old temporary password login fails
      const oldLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: testStudentId,
          password: testStudentPassword,
        });
      expect(oldLoginRes.status).toBe(401);

      // 11. New password login succeeds
      const newLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: testStudentId,
          password: newPassword,
        });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.expiresIn).toBe(900);
      expect(newLoginRes.body.user.mustChangePassword).toBe(false);
    });
  });
});