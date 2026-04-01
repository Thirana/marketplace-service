import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { configureApp } from '../src/app.setup';
import { AppModule } from '../src/app.module';
import {
  ADMIN_API_KEY_HEADER,
  INVALID_ADMIN_API_KEY_ERROR_CODE,
} from '../src/common/auth/admin-api-key.constants';
import { Notification } from '../src/modules/notifications/entities/notification.entity';
import { Product } from '../src/modules/products/entities/product.entity';
import { parseErrorResponseBody } from './support/http-response.helpers';

const DEFAULT_CUSTOMER_DEVICE_TOKEN = 'fcm-registration-token-test-device-001';

type NotificationResponseBody = {
  id: string;
  orderId: string;
  type: string;
  status: string;
  targetDeviceTokenPreview: string;
  title: string;
  body: string;
  providerMessageId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  failedAt: string | null;
};

const createDeviceTokenPreview = (targetDeviceToken: string): string =>
  targetDeviceToken.length <= 16
    ? targetDeviceToken
    : `${targetDeviceToken.slice(0, 8)}...${targetDeviceToken.slice(-8)}`;

/**
 * Narrows the notification list response so the tests assert the explicit
 * notification read contract rather than depending on untyped response bodies.
 */
const parseNotificationsResponseBody = (
  body: unknown,
): NotificationResponseBody[] => {
  if (!Array.isArray(body)) {
    throw new Error('Expected an array notification response body.');
  }

  return body.map((item) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Notification response items must be objects.');
    }

    const {
      id,
      orderId,
      type,
      status,
      targetDeviceTokenPreview,
      title,
      body: notificationBody,
      providerMessageId,
      failureReason,
      createdAt,
      updatedAt,
      sentAt,
      failedAt,
    } = item as Record<string, unknown>;

    if (
      typeof id !== 'string' ||
      typeof orderId !== 'string' ||
      typeof type !== 'string' ||
      typeof status !== 'string' ||
      typeof targetDeviceTokenPreview !== 'string' ||
      typeof title !== 'string' ||
      typeof notificationBody !== 'string' ||
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string'
    ) {
      throw new Error('Notification response item is missing required fields.');
    }

    if (providerMessageId !== null && typeof providerMessageId !== 'string') {
      throw new Error(
        'Notification response providerMessageId must be string or null.',
      );
    }

    if (failureReason !== null && typeof failureReason !== 'string') {
      throw new Error(
        'Notification response failureReason must be string or null.',
      );
    }

    if (sentAt !== null && typeof sentAt !== 'string') {
      throw new Error('Notification response sentAt must be string or null.');
    }

    if (failedAt !== null && typeof failedAt !== 'string') {
      throw new Error('Notification response failedAt must be string or null.');
    }

    return {
      id,
      orderId,
      type,
      status,
      targetDeviceTokenPreview,
      title,
      body: notificationBody,
      providerMessageId,
      failureReason,
      createdAt,
      updatedAt,
      sentAt,
      failedAt,
    };
  });
};

describe('NotificationsController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let dataSource: DataSource | undefined;
  let productsRepository: Repository<Product> | undefined;
  let notificationsRepository: Repository<Notification> | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(moduleFixture.createNestApplication());
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.runMigrations();
    productsRepository = dataSource.getRepository(Product);
    notificationsRepository = dataSource.getRepository(Notification);
  });

  afterEach(async () => {
    if (dataSource) {
      await dataSource.query(
        'TRUNCATE TABLE "order_idempotency_keys", "notifications", "order_items", "orders", "products" RESTART IDENTITY CASCADE',
      );
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('persists a pending notification intent when an order is created', async () => {
    const product = await seedProduct({
      name: 'Notification Order Product',
      priceAmount: 12999,
      stockQuantity: 5,
    });

    const orderResponse = await request(app!.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', 'notification-persistence-check')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [{ productId: product.id, quantity: 1 }],
      })
      .expect(201);

    const notifications = await notificationsRepository!.find();

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      orderId: parseOrderId(orderResponse.body),
      type: 'ORDER_CREATED',
      status: 'PENDING',
      targetDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
      title: 'Order confirmed',
      providerMessageId: null,
      failureReason: null,
      sentAt: null,
      failedAt: null,
    });
    expect(notifications[0].body).toContain(notifications[0].orderId);
  });

  it('lists persisted notifications for an order with an admin API key', async () => {
    const product = await seedProduct({
      name: 'Notification Read Product',
      priceAmount: 12999,
      stockQuantity: 5,
    });

    const orderResponse = await request(app!.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', 'notification-read-check')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [{ productId: product.id, quantity: 1 }],
      })
      .expect(201);

    const orderId = parseOrderId(orderResponse.body);
    const response = await request(app!.getHttpServer())
      .get(`/orders/${orderId}/notifications`)
      .set(ADMIN_API_KEY_HEADER, 'test-admin-key')
      .expect(200);

    const body = parseNotificationsResponseBody(response.body);

    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      orderId,
      type: 'ORDER_CREATED',
      status: 'PENDING',
      targetDeviceTokenPreview: createDeviceTokenPreview(
        DEFAULT_CUSTOMER_DEVICE_TOKEN,
      ),
      title: 'Order confirmed',
      providerMessageId: null,
      failureReason: null,
      sentAt: null,
      failedAt: null,
    });
    expect(body[0].body).toContain(orderId);
  });

  it('rejects notification reads without an admin API key', async () => {
    const response = await request(app!.getHttpServer())
      .get('/orders/8c9f7e84-26b9-4d81-9e54-15e1d0f4d91f/notifications')
      .expect(401);

    const body = parseErrorResponseBody(response.body);

    expect(body.errorCode).toBe(INVALID_ADMIN_API_KEY_ERROR_CODE);
  });

  it('returns 404 when the order does not exist', async () => {
    const response = await request(app!.getHttpServer())
      .get('/orders/8c9f7e84-26b9-4d81-9e54-15e1d0f4d91f/notifications')
      .set(ADMIN_API_KEY_HEADER, 'test-admin-key')
      .expect(404);

    const body = parseErrorResponseBody(response.body);

    expect(body.errorCode).toBe('ORDER_NOT_FOUND');
  });

  /**
   * Seeds products directly through the repository so notification tests can
   * focus on order-driven notification behavior without admin product setup.
   */
  async function seedProduct(
    overrides: Partial<
      Pick<
        Product,
        'name' | 'priceAmount' | 'currency' | 'stockQuantity' | 'isActive'
      >
    > = {},
  ): Promise<Product> {
    return productsRepository!.save(
      productsRepository!.create({
        name: overrides.name ?? 'Notification Product',
        description: 'Product used by notification e2e tests.',
        priceAmount: overrides.priceAmount ?? 1099,
        currency: overrides.currency ?? 'LKR',
        stockQuantity: overrides.stockQuantity ?? 5,
        isActive: overrides.isActive ?? true,
      }),
    );
  }

  function parseOrderId(body: unknown): string {
    if (typeof body !== 'object' || body === null) {
      throw new Error('Expected an object order response body.');
    }

    const { id } = body as Record<string, unknown>;

    if (typeof id !== 'string') {
      throw new Error('Order response body is missing id.');
    }

    return id;
  }
});
