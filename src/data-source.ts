import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { CreateOrderEvents1793644456425 } from './migrations/1793644456425-CreateOrderEvents.js';
import { CreateDeadLetterEvents1793644960980 } from './migrations/1793644960980-CreateDeadLetterEvents.js';
import { DeadLetterEvent } from './order-events/dead-letter-event.entity.js';
import { ProcessedEvent } from './order-events/processed-event.entity.js';
import { WebhookEvent } from './order-events/webhook-event.entity.js';

type SqliteOptions = Extract<DataSourceOptions, { type: 'better-sqlite3' }>;

/** One source for the app and the migration CLI. List every entity and migration class explicitly. */
export const dataSourceOptions: SqliteOptions = {
  type: 'better-sqlite3',
  database: process.env.DB_PATH ?? 'data.sqlite',
  entities: [WebhookEvent, ProcessedEvent, DeadLetterEvent],
  migrations: [CreateOrderEvents1793644456425, CreateDeadLetterEvents1793644960980],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
