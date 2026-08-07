import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Assessments API (e2e)', () => {
  let app: INestApplication;
  let teacherToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();

    // Login once and keep the JWT for protected API tests.
    const loginResponse = await request(
      app.getHttpServer(),
    )
      .post('/auth/login')
      .send({
        email: 'preethika@example.com',
        password: 'StrongPass123!',
      })
      .expect(200);

    teacherToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /assessments allows authenticated teacher', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/assessments')
      .set(
        'Authorization',
        `Bearer ${teacherToken}`,
      );

    expect(response.status).toBe(200);
  });

  it('GET /assessments rejects missing token', async () => {
    await request(app.getHttpServer())
      .get('/assessments')
      .expect(401);
  });

  it('GET /assessments rejects invalid token', async () => {
    await request(app.getHttpServer())
      .get('/assessments')
      .set(
        'Authorization',
        'Bearer invalid-token',
      )
      .expect(401);
  });
});