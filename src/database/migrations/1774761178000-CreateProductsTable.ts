import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductsTable1774761178000 implements MigrationInterface {
  name = 'CreateProductsTable1774761178000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "price_amount" integer NOT NULL,
        "currency" character varying(3) NOT NULL,
        "stock_quantity" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "CHK_products_price_amount_non_negative" CHECK ("price_amount" >= 0),
        CONSTRAINT "CHK_products_stock_quantity_non_negative" CHECK ("stock_quantity" >= 0),
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "products"');
  }
}
