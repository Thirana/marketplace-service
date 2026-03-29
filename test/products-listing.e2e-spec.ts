import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { AppModule } from '../src/app.module';
import { Product } from '../src/modules/products/entities/product.entity';
import { parseErrorResponseBody } from './support/http-response.helpers';

type ProductItem = {
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

type ProductsListBody = {
  items: ProductItem[];
  pageInfo: {
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
};

/**
 * Narrows the listing response into the public products page contract so the
 * e2e tests can assert cursor behavior without `any` casts.
 */
const parseProductsListBody = (body: unknown): ProductsListBody => {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Expected an object products list response body.');
  }

  const { items, pageInfo } = body as Record<string, unknown>;

  if (!Array.isArray(items)) {
    throw new Error('Products list response items must be an array.');
  }

  if (typeof pageInfo !== 'object' || pageInfo === null) {
    throw new Error('Products list response pageInfo must be an object.');
  }

  const typedPageInfo = pageInfo as Record<string, unknown>;

  if (
    typeof typedPageInfo.limit !== 'number' ||
    typeof typedPageInfo.hasNextPage !== 'boolean' ||
    (typedPageInfo.nextCursor !== null &&
      typeof typedPageInfo.nextCursor !== 'string')
  ) {
    throw new Error('Products list response pageInfo is invalid.');
  }

  return {
    items: items as ProductItem[],
    pageInfo: {
      limit: typedPageInfo.limit,
      hasNextPage: typedPageInfo.hasNextPage,
      nextCursor: typedPageInfo.nextCursor,
    },
  };
};

describe('Products listing (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let dataSource: DataSource | undefined;
  let productsRepository: Repository<Product> | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(moduleFixture.createNestApplication());
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.runMigrations();
    productsRepository = dataSource.getRepository(Product);
  });

  afterEach(async () => {
    if (dataSource) {
      await dataSource.query(
        'TRUNCATE TABLE "order_idempotency_keys", "order_items", "orders", "products" RESTART IDENTITY CASCADE',
      );
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns the first page in stable created_at and id descending order', async () => {
    const thirdProduct = await seedProduct(
      'Third Product',
      '2026-03-29T04:45:24.000Z',
    );
    const secondProduct = await seedProduct(
      'Second Product',
      '2026-03-29T04:45:23.000Z',
    );
    const firstProduct = await seedProduct(
      'First Product',
      '2026-03-29T04:45:22.000Z',
    );

    const response = await request(app!.getHttpServer())
      .get('/products?limit=2')
      .expect(200);

    const body = parseProductsListBody(response.body);

    expect(body.items.map((product) => product.id)).toEqual([
      thirdProduct.id,
      secondProduct.id,
    ]);
    expect(body.pageInfo.limit).toBe(2);
    expect(body.pageInfo.hasNextPage).toBe(true);
    expect(body.pageInfo.nextCursor).toEqual(expect.any(String));
    expect(firstProduct.id).toEqual(expect.any(String));
  });

  it('returns the next page when a valid cursor is supplied', async () => {
    await seedProduct('Third Product', '2026-03-29T04:45:24.000Z');
    const secondProduct = await seedProduct(
      'Second Product',
      '2026-03-29T04:45:23.000Z',
    );
    const firstProduct = await seedProduct(
      'First Product',
      '2026-03-29T04:45:22.000Z',
    );

    const firstPage = parseProductsListBody(
      (await request(app!.getHttpServer()).get('/products?limit=2').expect(200))
        .body,
    );

    const response = await request(app!.getHttpServer())
      .get('/products')
      .query({
        limit: 2,
        cursor: firstPage.pageInfo.nextCursor,
      })
      .expect(200);

    const body = parseProductsListBody(response.body);

    expect(body.items.map((product) => product.id)).toEqual([firstProduct.id]);
    expect(body.items[0]?.id).not.toBe(secondProduct.id);
    expect(body.pageInfo.hasNextPage).toBe(false);
    expect(body.pageInfo.nextCursor).toBeNull();
  });

  it('enforces the maximum page size constraint', async () => {
    const response = await request(app!.getHttpServer())
      .get('/products?limit=100')
      .expect(400);

    const body = parseErrorResponseBody(response.body);

    expect(body.statusCode).toBe(400);
  });

  it('excludes inactive and soft-deleted products from public listing', async () => {
    const visibleProduct = await seedProduct(
      'Visible Product',
      '2026-03-29T04:45:24.000Z',
      true,
    );
    await seedProduct('Inactive Product', '2026-03-29T04:45:23.000Z', false);
    const deletedProduct = await seedProduct(
      'Deleted Product',
      '2026-03-29T04:45:22.000Z',
      true,
    );

    await productsRepository!.softDelete(deletedProduct.id);

    const response = await request(app!.getHttpServer())
      .get('/products')
      .expect(200);

    const body = parseProductsListBody(response.body);

    expect(body.items.map((product) => product.id)).toEqual([
      visibleProduct.id,
    ]);
  });

  /**
   * Seeds a product directly through the repository so the listing tests can
   * control timestamps precisely without coupling to admin write endpoints.
   */
  async function seedProduct(
    name: string,
    createdAt: string,
    isActive = true,
  ): Promise<Product> {
    const savedProduct = await productsRepository!.save(
      productsRepository!.create({
        name,
        description: `${name} description`,
        priceAmount: 1099,
        currency: 'LKR',
        stockQuantity: 5,
        isActive,
      }),
    );

    await dataSource!.query(
      'UPDATE "products" SET "created_at" = $1, "updated_at" = $1 WHERE "id" = $2',
      [createdAt, savedProduct.id],
    );

    return productsRepository!.findOneByOrFail({ id: savedProduct.id });
  }
});
