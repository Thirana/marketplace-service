import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  ADMIN_API_KEY_HEADER,
  INVALID_ADMIN_API_KEY_ERROR_CODE,
} from '../src/common/auth/admin-api-key.constants';
import { configureApp } from '../src/app.setup';
import { AppModule } from '../src/app.module';
import { parseErrorResponseBody } from './support/http-response.helpers';

type ProductResponseBody = {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currency: string;
  stockQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Narrows the generic response body into the public product shape returned by
 * the admin CRUD endpoints so the e2e assertions stay explicit and type-safe.
 */
const parseProductResponseBody = (body: unknown): ProductResponseBody => {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Expected an object product response body.');
  }

  const {
    id,
    name,
    description,
    priceAmount,
    currency,
    stockQuantity,
    isActive,
    createdAt,
    updatedAt,
  } = body as Record<string, unknown>;

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    (description !== null && typeof description !== 'string') ||
    typeof priceAmount !== 'number' ||
    typeof currency !== 'string' ||
    typeof stockQuantity !== 'number' ||
    typeof isActive !== 'boolean' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    throw new Error('Product response body is missing required fields.');
  }

  return {
    id,
    name,
    description,
    priceAmount,
    currency,
    stockQuantity,
    isActive,
    createdAt,
    updatedAt,
  };
};

describe('ProductsController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let dataSource: DataSource | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(moduleFixture.createNestApplication());
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.runMigrations();
  });

  afterEach(async () => {
    if (dataSource) {
      await dataSource.query('TRUNCATE TABLE "products"');
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects product creation without the admin API key', async () => {
    const response = await request(app!.getHttpServer())
      .post('/products')
      .send({
        name: 'Wireless Mechanical Keyboard',
        priceAmount: 12999,
        currency: 'USD',
        stockQuantity: 25,
      })
      .expect(401);

    const body = parseErrorResponseBody(response.body);

    expect(body.errorCode).toBe(INVALID_ADMIN_API_KEY_ERROR_CODE);
  });

  it('creates a product for an authorized admin', async () => {
    const response = await request(app!.getHttpServer())
      .post('/products')
      .set(ADMIN_API_KEY_HEADER, 'test-admin-key')
      .send({
        name: 'Wireless Mechanical Keyboard',
        description: 'Compact keyboard with hot-swappable switches.',
        priceAmount: 12999,
        currency: 'USD',
        stockQuantity: 25,
      })
      .expect(201);

    const body = parseProductResponseBody(response.body);

    expect(body).toMatchObject({
      name: 'Wireless Mechanical Keyboard',
      description: 'Compact keyboard with hot-swappable switches.',
      priceAmount: 12999,
      currency: 'USD',
      stockQuantity: 25,
      isActive: true,
    });
    expect(body.id).toEqual(expect.any(String));
  });

  it('updates an existing product for an authorized admin', async () => {
    const createdProduct = parseProductResponseBody(
      (
        await request(app!.getHttpServer())
          .post('/products')
          .set(ADMIN_API_KEY_HEADER, 'test-admin-key')
          .send({
            name: 'Wireless Mechanical Keyboard',
            priceAmount: 12999,
            currency: 'USD',
            stockQuantity: 25,
          })
          .expect(201)
      ).body,
    );

    const response = await request(app!.getHttpServer())
      .patch(`/products/${createdProduct.id}`)
      .set(ADMIN_API_KEY_HEADER, 'test-admin-key')
      .send({
        name: 'Wireless Mechanical Keyboard Pro',
        priceAmount: 14999,
        stockQuantity: 20,
        isActive: false,
      })
      .expect(200);

    const body = parseProductResponseBody(response.body);

    expect(body).toMatchObject({
      id: createdProduct.id,
      name: 'Wireless Mechanical Keyboard Pro',
      priceAmount: 14999,
      stockQuantity: 20,
      isActive: false,
    });
  });

  it('deletes an existing product for an authorized admin', async () => {
    const createdProduct = parseProductResponseBody(
      (
        await request(app!.getHttpServer())
          .post('/products')
          .set(ADMIN_API_KEY_HEADER, 'test-admin-key')
          .send({
            name: 'Wireless Mechanical Keyboard',
            priceAmount: 12999,
            currency: 'USD',
            stockQuantity: 25,
          })
          .expect(201)
      ).body,
    );

    await request(app!.getHttpServer())
      .delete(`/products/${createdProduct.id}`)
      .set(ADMIN_API_KEY_HEADER, 'test-admin-key')
      .expect(204);

    await request(app!.getHttpServer())
      .patch(`/products/${createdProduct.id}`)
      .set(ADMIN_API_KEY_HEADER, 'test-admin-key')
      .send({ name: 'Deleted Product' })
      .expect(404);
  });
});
