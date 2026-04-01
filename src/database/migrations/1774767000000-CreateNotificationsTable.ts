import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsTable1774767000000 implements MigrationInterface {
  name = 'CreateNotificationsTable1774767000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "type" character varying(64) NOT NULL,
        "status" character varying(32) NOT NULL,
        "target_device_token" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "provider_message_id" character varying(255),
        "failure_reason" text,
        "sent_at" TIMESTAMPTZ,
        "failed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_notifications_type" CHECK ("type" IN ('ORDER_CREATED')),
        CONSTRAINT "CHK_notifications_status" CHECK ("status" IN ('PENDING', 'SENT', 'FAILED')),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_order_id" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_order_id_created_at"
      ON "notifications" ("order_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."IDX_notifications_order_id_created_at"',
    );
    await queryRunner.query('DROP TABLE "notifications"');
  }
}
