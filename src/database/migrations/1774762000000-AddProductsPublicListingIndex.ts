import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductsPublicListingIndex1774762000000 implements MigrationInterface {
  name = 'AddProductsPublicListingIndex1774762000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_products_public_listing"
      ON "products" ("created_at" DESC, "id" DESC)
      WHERE "deleted_at" IS NULL AND "is_active" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."IDX_products_public_listing"',
    );
  }
}
