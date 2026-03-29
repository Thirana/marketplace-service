import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup';
import { AppModule } from './../src/app.module';
import { parseErrorResponseBody } from './support/http-response.helpers';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App> | undefined;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(moduleFixture.createNestApplication());
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('/health/live (GET)', () => {
    return request(app!.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'ok',
          checks: {
            application: 'up',
          },
        });
      });
  });

  it('/health/ready (GET)', () => {
    return request(app!.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'ok',
          checks: {
            database: 'up',
          },
        });
      });
  });

  it('returns the standardized error shape for unknown routes', () => {
    return request(app!.getHttpServer())
      .get('/unknown-route')
      .expect(404)
      .expect(
        (response: {
          body: unknown;
          headers: Record<string, string | string[] | undefined>;
        }) => {
          const body = parseErrorResponseBody(response.body);
          const requestIdHeader = response.headers['x-request-id'];

          expect(body.statusCode).toBe(404);
          expect(body.errorCode).toBe('NOT_FOUND');
          expect(body.requestId).toEqual(expect.any(String));
          expect(body.timestamp).toEqual(expect.any(String));
          expect(requestIdHeader).toBe(body.requestId);
        },
      );
  });
});
