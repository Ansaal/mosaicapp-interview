import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderEvents1793644456425 implements MigrationInterface {
  name = 'CreateOrderEvents1793644456425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "processed_events" ("event_id" varchar PRIMARY KEY NOT NULL, "type" varchar NOT NULL, "payload" text NOT NULL, "webhook_event_id" integer NOT NULL, "processed_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_events" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "raw_body" text NOT NULL, "status" varchar NOT NULL DEFAULT ('pending'), "received_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_3c7531a4e997b0b084746b11e2" ON "webhook_events" ("status", "id") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_3c7531a4e997b0b084746b11e2"`);
    await queryRunner.query(`DROP TABLE "webhook_events"`);
    await queryRunner.query(`DROP TABLE "processed_events"`);
  }
}
