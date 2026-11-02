import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeadLetterEvents1793644960980 implements MigrationInterface {
  name = 'CreateDeadLetterEvents1793644960980';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "dead_letter_events" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "webhook_event_id" integer NOT NULL, "raw_body" text NOT NULL, "reasons" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_7f9f125f2b161eaecb006384a33" UNIQUE ("webhook_event_id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "dead_letter_events"`);
  }
}
