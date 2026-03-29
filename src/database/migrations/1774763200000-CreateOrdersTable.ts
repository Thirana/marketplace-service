import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersTable1774763200000 implements MigrationInterface {
  name = 'CreateOrdersTable1774763200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "idempotency_key" character varying(255) NOT NULL,
        "total_price_amount" integer NOT NULL,
        "currency" character varying(3) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_orders_total_price_amount_non_negative" CHECK ("total_price_amount" >= 0),
        CONSTRAINT "CHK_orders_currency_lkr" CHECK ("currency" = 'LKR'),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price_amount" integer NOT NULL,
        "line_total_amount" integer NOT NULL,
        "currency" character varying(3) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_order_items_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "CHK_order_items_unit_price_amount_non_negative" CHECK ("unit_price_amount" >= 0),
        CONSTRAINT "CHK_order_items_line_total_amount_non_negative" CHECK ("line_total_amount" >= 0),
        CONSTRAINT "CHK_order_items_line_total_matches_quantity" CHECK ("line_total_amount" = "unit_price_amount" * "quantity"),
        CONSTRAINT "CHK_order_items_currency_lkr" CHECK ("currency" = 'LKR'),
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_items_order_id" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_order_items_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_order_items_order_id"
      ON "order_items" ("order_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_order_items_order_id"');
    await queryRunner.query('DROP TABLE "order_items"');
    await queryRunner.query('DROP TABLE "orders"');
  }
}
