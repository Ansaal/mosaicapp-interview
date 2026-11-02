import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { dataSourceOptions } from './data-source.js';
import { OrderEventsModule } from './order-events/order-events.module.js';

@Module({
  imports: [
    // src/load-env.ts loads .env before any module is evaluated; ConfigModule only validates process.env.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({ ...dataSourceOptions, migrationsRun: true, retryAttempts: 0 }),
    }),
    DatabaseModule,
    OrderEventsModule,
  ],
})
export class AppModule {}
