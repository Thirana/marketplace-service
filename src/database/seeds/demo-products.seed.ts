import dataSource from '../typeorm.datasource';

const DEMO_PRODUCTS_COUNT = 80;
const DEMO_CREATED_AT_BASE = Date.parse('2026-01-01T12:00:00.000Z');
const DEMO_PRODUCT_CURRENCY = 'LKR' as const;
const ADJECTIVES = [
  'Aurora',
  'Summit',
  'Drift',
  'Atlas',
  'Nova',
  'Harbor',
  'Cinder',
  'Lumen',
  'Echo',
  'Solstice',
] as const;
const PRODUCT_TYPES = [
  'Keyboard',
  'Mouse',
  'Monitor',
  'Headset',
  'Dock',
  'Webcam',
  'Speaker',
  'Microphone',
  'Lamp',
  'Chair',
] as const;

type DemoProductSeed = {
  id: string;
  name: string;
  description: string;
  priceAmount: number;
  currency: typeof DEMO_PRODUCT_CURRENCY;
  stockQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Builds a deterministic set of demo products with fixed UUIDs and timestamps
 * so pagination can be demonstrated repeatably across local runs and interviews.
 */
const buildDemoProducts = (): DemoProductSeed[] =>
  Array.from({ length: DEMO_PRODUCTS_COUNT }, (_, index) => {
    const sequence = index + 1;
    const adjective = ADJECTIVES[index % ADJECTIVES.length];
    const productType =
      PRODUCT_TYPES[Math.floor(index / 2) % PRODUCT_TYPES.length];
    const timestamp = new Date(
      DEMO_CREATED_AT_BASE - Math.floor(index / 2) * 60_000,
    ).toISOString();

    return {
      id: `00000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`,
      name: `Demo Product ${sequence.toString().padStart(3, '0')} - ${adjective} ${productType}`,
      description: `Deterministic demo catalog entry ${sequence} for pagination walkthroughs and API review.`,
      priceAmount: 4_900 + sequence * 175,
      currency: DEMO_PRODUCT_CURRENCY,
      stockQuantity: 5 + (index % 40),
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

/**
 * Upserts the deterministic demo catalog so rerunning the seed refreshes the
 * same 80 rows without touching non-demo products created through the API.
 */
const seedDemoProducts = async (): Promise<void> => {
  await dataSource.initialize();

  try {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const product of buildDemoProducts()) {
        await queryRunner.query(
          `
            INSERT INTO "products" (
              "id",
              "name",
              "description",
              "price_amount",
              "currency",
              "stock_quantity",
              "is_active",
              "created_at",
              "updated_at",
              "deleted_at"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)
            ON CONFLICT ("id") DO UPDATE
            SET
              "name" = EXCLUDED."name",
              "description" = EXCLUDED."description",
              "price_amount" = EXCLUDED."price_amount",
              "currency" = EXCLUDED."currency",
              "stock_quantity" = EXCLUDED."stock_quantity",
              "is_active" = EXCLUDED."is_active",
              "created_at" = EXCLUDED."created_at",
              "updated_at" = EXCLUDED."updated_at",
              "deleted_at" = NULL
          `,
          [
            product.id,
            product.name,
            product.description,
            product.priceAmount,
            product.currency,
            product.stockQuantity,
            product.isActive,
            product.createdAt,
            product.updatedAt,
          ],
        );
      }

      await queryRunner.commitTransaction();
      console.log(
        `Seeded ${DEMO_PRODUCTS_COUNT} deterministic demo products in ${DEMO_PRODUCT_CURRENCY} for pagination testing.`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  } finally {
    await dataSource.destroy();
  }
};

seedDemoProducts().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown demo seed failure';
  console.error(message);
  process.exit(1);
});
