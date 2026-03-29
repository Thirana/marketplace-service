import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderIdempotencyKeysTable1774765200000 implements MigrationInterface {
  name = 'CreateOrderIdempotencyKeysTable1774765200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_idempotency_keys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "idempotency_key" character varying(255) NOT NULL,
        "request_fingerprint" character varying(64) NOT NULL,
        "status" character varying(32) NOT NULL,
        "response_status_code" integer NOT NULL DEFAULT 201,
        "order_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_order_idempotency_keys_status" CHECK ("status" IN ('IN_PROGRESS', 'COMPLETED')),
        CONSTRAINT "CHK_order_idempotency_keys_response_status_code_positive" CHECK ("response_status_code" > 0),
        CONSTRAINT "PK_order_idempotency_keys_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_order_idempotency_keys_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "UQ_order_idempotency_keys_order_id" UNIQUE ("order_id"),
        CONSTRAINT "FK_order_idempotency_keys_order_id" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "order_idempotency_keys"');
  }
}
