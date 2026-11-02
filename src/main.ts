// Must stay the first import: loads .env before any other module reads process.env.
import './load-env.js';
import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { appOptions } from './app-options.js';
import { AppModule } from './app.module.js';

// Threshold read by ConsoleLogger: 'log' enables log, warn, error, fatal. `||=` also replaces an empty value.
process.env.NEST_LOG_LEVEL ||= 'log';

const logger = new ConsoleLogger({
  json: true,
  redact: ['password', 'token', 'authorization', 'cookie', 'x-signature'],
});
const toError = (thrown: unknown): Error => (thrown instanceof Error ? thrown : new Error(String(thrown)));
process.on('uncaughtException', (thrown) => {
  logger.fatal('Uncaught exception', { source: 'process' }, toError(thrown));
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal('Unhandled rejection', { source: 'process' }, toError(reason));
  process.exit(1);
});

const app = await NestFactory.create<NestExpressApplication>(AppModule, { ...appOptions, logger });
app.enableShutdownHooks();
await app.listen(process.env.PORT ?? 3000);
