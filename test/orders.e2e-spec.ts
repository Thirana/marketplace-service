import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { AppModule } from '../src/app.module';
import {
  IDEMPOTENCY_KEY_HEADER,
  MISSING_IDEMPOTENCY_KEY_ERROR_CODE,
} from '../src/common/http/idempotency-key.constants';
import { Notification } from '../src/modules/notifications/entities/notification.entity';
import { OrderIdempotencyKey } from '../src/modules/orders/entities/order-idempotency-key.entity';
import { OrderItem } from '../src/modules/orders/entities/order-item.entity';
import { Order } from '../src/modules/orders/entities/order.entity';
import { Product } from '../src/modules/products/entities/product.entity';
import { parseErrorResponseBody } from './support/http-response.helpers';

type OrderItemResponseBody = {
  id: string;
  productId: string;
  quantity: number;
  unitPriceAmount: number;
  lineTotalAmount: number;
  currency: string;
};

type OrderResponseBody = {
  id: string;
  items: OrderItemResponseBody[];
  totalPriceAmount: number;
  currency: string;
  createdAt: string;
};

const DEFAULT_CUSTOMER_DEVICE_TOKEN = 'fcm-registration-token-test-device-001';

/**
 * Narrows the public order creation response so the tests assert the explicit
 * basket contract rather than depending on untyped response bodies.
 */
const parseOrderResponseBody = (body: unknown): OrderResponseBody => {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Expected an object order response body.');
  }

  const { id, items, totalPriceAmount, currency, createdAt } = body as Record<
    string,
    unknown
  >;

  if (
    typeof id !== 'string' ||
    !Array.isArray(items) ||
    typeof totalPriceAmount !== 'number' ||
    typeof currency !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    throw new Error('Order response body is missing required fields.');
  }

  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Order response items must be objects.');
    }

    const {
      id: orderItemId,
      productId,
      quantity,
      unitPriceAmount,
      lineTotalAmount,
      currency: itemCurrency,
    } = item as Record<string, unknown>;

    if (
      typeof orderItemId !== 'string' ||
      typeof productId !== 'string' ||
      typeof quantity !== 'number' ||
      typeof unitPriceAmount !== 'number' ||
      typeof lineTotalAmount !== 'number' ||
      typeof itemCurrency !== 'string'
    ) {
      throw new Error('Order response item is missing required fields.');
    }
  }

  return {
    id,
    items: items as OrderItemResponseBody[],
    totalPriceAmount,
    currency,
    createdAt,
  };
};

describe('OrdersController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let dataSource: DataSource | undefined;
  let productsRepository: Repository<Product> | undefined;
  let ordersRepository: Repository<Order> | undefined;
  let orderItemsRepository: Repository<OrderItem> | undefined;
  let orderIdempotencyKeysRepository:
    | Repository<OrderIdempotencyKey>
    | undefined;
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
    ordersRepository = dataSource.getRepository(Order);
    orderItemsRepository = dataSource.getRepository(OrderItem);
    orderIdempotencyKeysRepository =
      dataSource.getRepository(OrderIdempotencyKey);
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

  it('rejects order creation without an Idempotency-Key header', async () => {
    const product = await seedProduct();

    const response = await request(app!.getHttpServer())
      .post('/orders')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [{ productId: product.id, quantity: 1 }],
      })
      .expect(400);

    const body = parseErrorResponseBody(response.body);

    expect(body.errorCode).toBe(MISSING_IDEMPOTENCY_KEY_ERROR_CODE);
  });

  it('rejects an empty basket', async () => {
    const response = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'empty-basket-check')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [],
      })
      .expect(400);

    const body = parseErrorResponseBody(response.body);

    expect(body.statusCode).toBe(400);
  });

  it('rejects order creation without a customer device token', async () => {
    const product = await seedProduct();

    const response = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'missing-device-token-check')
      .send({
        items: [{ productId: product.id, quantity: 1 }],
      })
      .expect(400);

    const body = parseErrorResponseBody(response.body);

    expect(body.statusCode).toBe(400);
  });

  it('rejects duplicate products in the same basket', async () => {
    const product = await seedProduct();

    const response = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'duplicate-product-check')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [
          { productId: product.id, quantity: 1 },
          { productId: product.id, quantity: 2 },
        ],
      })
      .expect(400);

    const body = parseErrorResponseBody(response.body);

    expect(body.errorCode).toBe('DUPLICATE_ORDER_PRODUCT');
  });

  it('rejects orders for missing products', async () => {
    const response = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'missing-product-check')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [
          {
            productId: '8c9f7e84-26b9-4d81-9e54-15e1d0f4d91f',
            quantity: 1,
          },
        ],
      })
      .expect(404);

    const body = parseErrorResponseBody(response.body);

    expect(body.errorCode).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejects orders for inactive products', async () => {
    const product = await seedProduct({ isActive: false });

    const response = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'inactive-product-check')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [{ productId: product.id, quantity: 1 }],
      })
      .expect(409);

    const body = parseErrorResponseBody(response.body);

    expect(body.errorCode).toBe('PRODUCT_NOT_AVAILABLE');
  });

  it('rejects orders for products that are not priced in LKR', async () => {
    const product = await seedProduct({ currency: 'USD' });

    const response = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'unsupported-currency-check')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [{ productId: product.id, quantity: 1 }],
      })
      .expect(409);

    const body = parseErrorResponseBody(response.body);

    expect(body.errorCode).toBe('UNSUPPORTED_PRODUCT_CURRENCY');
  });

  it('rejects orders when requested quantity exceeds stock', async () => {
    const product = await seedProduct({ stockQuantity: 2 });

    const response = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'stock-check')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [{ productId: product.id, quantity: 3 }],
      })
      .expect(409);

    const body = parseErrorResponseBody(response.body);

    expect(body.errorCode).toBe('INSUFFICIENT_PRODUCT_STOCK');
  });

  it('creates a multi-item order, snapshots line-item pricing, and reduces stock', async () => {
    const firstProduct = await seedProduct({
      name: 'Orderable Keyboard',
      priceAmount: 12999,
      stockQuantity: 5,
    });
    const secondProduct = await seedProduct({
      name: 'Orderable Mouse',
      priceAmount: 8999,
      stockQuantity: 4,
    });
    const thirdProduct = await seedProduct({
      name: 'Orderable Headset',
      priceAmount: 15999,
      stockQuantity: 7,
    });

    const response = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'create-order-success')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [
          { productId: firstProduct.id, quantity: 2 },
          { productId: secondProduct.id, quantity: 1 },
          { productId: thirdProduct.id, quantity: 3 },
        ],
      })
      .expect(201);

    const body = parseOrderResponseBody(response.body);
    const persistedOrder = await ordersRepository!.findOneByOrFail({
      id: body.id,
    });
    const persistedOrderItems = await orderItemsRepository!.find({
      where: { orderId: body.id },
      order: { createdAt: 'ASC' },
    });
    const updatedFirstProduct = await productsRepository!.findOneByOrFail({
      id: firstProduct.id,
    });
    const updatedSecondProduct = await productsRepository!.findOneByOrFail({
      id: secondProduct.id,
    });
    const updatedThirdProduct = await productsRepository!.findOneByOrFail({
      id: thirdProduct.id,
    });

    expect(body.totalPriceAmount).toBe(82994);
    expect(body.currency).toBe('LKR');
    expect(body.items).toHaveLength(3);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: firstProduct.id,
          quantity: 2,
          unitPriceAmount: 12999,
          lineTotalAmount: 25998,
          currency: 'LKR',
        }),
        expect.objectContaining({
          productId: secondProduct.id,
          quantity: 1,
          unitPriceAmount: 8999,
          lineTotalAmount: 8999,
          currency: 'LKR',
        }),
        expect.objectContaining({
          productId: thirdProduct.id,
          quantity: 3,
          unitPriceAmount: 15999,
          lineTotalAmount: 47997,
          currency: 'LKR',
        }),
      ]),
    );
    expect(persistedOrder.idempotencyKey).toBe('create-order-success');
    expect(persistedOrder.totalPriceAmount).toBe(82994);
    expect(persistedOrder.currency).toBe('LKR');
    expect(persistedOrderItems).toHaveLength(3);
    expect(await notificationsRepository!.count()).toBe(1);
    expect(updatedFirstProduct.stockQuantity).toBe(3);
    expect(updatedSecondProduct.stockQuantity).toBe(3);
    expect(updatedThirdProduct.stockQuantity).toBe(4);
  });

  it('replays the original order when the same idempotency key and basket are retried', async () => {
    const firstProduct = await seedProduct({
      name: 'Replay Product A',
      priceAmount: 12999,
      stockQuantity: 5,
    });
    const secondProduct = await seedProduct({
      name: 'Replay Product B',
      priceAmount: 8999,
      stockQuantity: 4,
    });

    const firstResponse = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'replay-same-basket')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [
          { productId: firstProduct.id, quantity: 1 },
          { productId: secondProduct.id, quantity: 2 },
        ],
      })
      .expect(201);

    const replayResponse = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'replay-same-basket')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [
          { productId: firstProduct.id, quantity: 1 },
          { productId: secondProduct.id, quantity: 2 },
        ],
      })
      .expect(201);

    const firstBody = parseOrderResponseBody(firstResponse.body);
    const replayBody = parseOrderResponseBody(replayResponse.body);
    const updatedFirstProduct = await productsRepository!.findOneByOrFail({
      id: firstProduct.id,
    });
    const updatedSecondProduct = await productsRepository!.findOneByOrFail({
      id: secondProduct.id,
    });

    expect(replayBody).toEqual(firstBody);
    expect(await ordersRepository!.count()).toBe(1);
    expect(await orderItemsRepository!.count()).toBe(2);
    expect(await orderIdempotencyKeysRepository!.count()).toBe(1);
    expect(await notificationsRepository!.count()).toBe(1);
    expect(updatedFirstProduct.stockQuantity).toBe(4);
    expect(updatedSecondProduct.stockQuantity).toBe(2);
  });

  it('replays the original order when the same basket is retried in a different item order', async () => {
    const firstProduct = await seedProduct({
      name: 'Canonical Product A',
      priceAmount: 12999,
      stockQuantity: 5,
    });
    const secondProduct = await seedProduct({
      name: 'Canonical Product B',
      priceAmount: 8999,
      stockQuantity: 4,
    });

    const firstResponse = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'replay-canonical-basket')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [
          { productId: firstProduct.id, quantity: 1 },
          { productId: secondProduct.id, quantity: 2 },
        ],
      })
      .expect(201);

    const replayResponse = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'replay-canonical-basket')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [
          { productId: secondProduct.id, quantity: 2 },
          { productId: firstProduct.id, quantity: 1 },
        ],
      })
      .expect(201);

    expect(parseOrderResponseBody(replayResponse.body)).toEqual(
      parseOrderResponseBody(firstResponse.body),
    );
    expect(await ordersRepository!.count()).toBe(1);
    expect(await orderItemsRepository!.count()).toBe(2);
    expect(await orderIdempotencyKeysRepository!.count()).toBe(1);
    expect(await notificationsRepository!.count()).toBe(1);
  });

  it('rejects a reused idempotency key when the basket changes', async () => {
    const firstProduct = await seedProduct({
      name: 'Conflict Product A',
      priceAmount: 12999,
      stockQuantity: 5,
    });
    const secondProduct = await seedProduct({
      name: 'Conflict Product B',
      priceAmount: 8999,
      stockQuantity: 4,
    });

    await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'replay-conflict-basket')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [
          { productId: firstProduct.id, quantity: 1 },
          { productId: secondProduct.id, quantity: 2 },
        ],
      })
      .expect(201);

    const conflictResponse = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'replay-conflict-basket')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [
          { productId: firstProduct.id, quantity: 2 },
          { productId: secondProduct.id, quantity: 2 },
        ],
      })
      .expect(409);

    const body = parseErrorResponseBody(conflictResponse.body);
    const updatedFirstProduct = await productsRepository!.findOneByOrFail({
      id: firstProduct.id,
    });
    const updatedSecondProduct = await productsRepository!.findOneByOrFail({
      id: secondProduct.id,
    });

    expect(body.errorCode).toBe('IDEMPOTENCY_REQUEST_CONFLICT');
    expect(await ordersRepository!.count()).toBe(1);
    expect(await orderItemsRepository!.count()).toBe(2);
    expect(await orderIdempotencyKeysRepository!.count()).toBe(1);
    expect(await notificationsRepository!.count()).toBe(1);
    expect(updatedFirstProduct.stockQuantity).toBe(4);
    expect(updatedSecondProduct.stockQuantity).toBe(2);
  });

  it('rejects a reused idempotency key when the customer device token changes', async () => {
    const firstProduct = await seedProduct({
      name: 'Conflict Product Token A',
      priceAmount: 12999,
      stockQuantity: 5,
    });
    const secondProduct = await seedProduct({
      name: 'Conflict Product Token B',
      priceAmount: 8999,
      stockQuantity: 4,
    });

    await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'replay-conflict-device-token')
      .send({
        customerDeviceToken: DEFAULT_CUSTOMER_DEVICE_TOKEN,
        items: [
          { productId: firstProduct.id, quantity: 1 },
          { productId: secondProduct.id, quantity: 2 },
        ],
      })
      .expect(201);

    const conflictResponse = await request(app!.getHttpServer())
      .post('/orders')
      .set(IDEMPOTENCY_KEY_HEADER, 'replay-conflict-device-token')
      .send({
        customerDeviceToken: 'fcm-registration-token-test-device-002',
        items: [
          { productId: firstProduct.id, quantity: 1 },
          { productId: secondProduct.id, quantity: 2 },
        ],
      })
      .expect(409);

    const body = parseErrorResponseBody(conflictResponse.body);
    const updatedFirstProduct = await productsRepository!.findOneByOrFail({
      id: firstProduct.id,
    });
    const updatedSecondProduct = await productsRepository!.findOneByOrFail({
      id: secondProduct.id,
    });

    expect(body.errorCode).toBe('IDEMPOTENCY_REQUEST_CONFLICT');
    expect(await ordersRepository!.count()).toBe(1);
    expect(await orderItemsRepository!.count()).toBe(2);
    expect(await orderIdempotencyKeysRepository!.count()).toBe(1);
    expect(await notificationsRepository!.count()).toBe(1);
    expect(updatedFirstProduct.stockQuantity).toBe(4);
    expect(updatedSecondProduct.stockQuantity).toBe(2);
  });

  /**
   * Seeds products directly through the repository so order tests can focus on
   * checkout behavior without depending on the admin product endpoints.
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
        name: overrides.name ?? 'Orderable Product',
        description: 'Product used by order e2e tests.',
        priceAmount: overrides.priceAmount ?? 1099,
        currency: overrides.currency ?? 'LKR',
        stockQuantity: overrides.stockQuantity ?? 5,
        isActive: overrides.isActive ?? true,
      }),
    );
  }
});
