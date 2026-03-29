import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup';
import { AppModule } from './../src/app.module';

type ErrorResponseBody = {
  statusCode: number;
  errorCode: string;
  requestId: string;
  timestamp: string;
};

/**
 * Narrows the generic supertest body into the standardized API error shape so
 * the e2e assertions stay type-safe and document the contract under test.
 */
const parseErrorResponseBody = (body: unknown): ErrorResponseBody => {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Expected an object error response body.');
  }

  const { statusCode, errorCode, requestId, timestamp } = body as Record<
    string,
    unknown
  >;

  if (
    typeof statusCode !== 'number' ||
    typeof errorCode !== 'string' ||
    typeof requestId !== 'string' ||
    typeof timestamp !== 'string'
  ) {
    throw new Error('Error response body is missing required fields.');
  }

  return {
    statusCode,
    errorCode,
    requestId,
    timestamp,
  };
};

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
