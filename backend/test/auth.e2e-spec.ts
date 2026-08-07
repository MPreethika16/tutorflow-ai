import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Auth API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login logs in a teacher', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .post('/auth/login')
      .send({
        email: 'preethika@example.com',
        password: 'StrongPass123!',
      });

    expect(response.status).toBe(200);

    expect(response.body).toHaveProperty(
      'accessToken',
    );
  });

  it('POST /auth/login rejects invalid credentials', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .post('/auth/login')
      .send({
        email: 'wrong@example.com',
        password: 'wrong-password',
      });

    expect(response.status).toBe(401);
  });
});