import type { LoggerService } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { appOptions } from '../../src/app-options.js';
import { AppModule } from '../../src/app.module.js';

export interface TestAppOptions {
  /** App logger, e.g. a CapturingLogger; `false` silences Nest's output. */
  logger?: LoggerService | false;
}

/** Boots the real AppModule with main.ts's create options. `override` replaces outbound boundaries only. */
export async function createTestApp(
  override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
  options: TestAppOptions = {},
): Promise<NestExpressApplication> {
  const moduleRef = await override(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...appOptions,
    ...(options.logger === undefined ? {} : { logger: options.logger }),
  });
  try {
    await app.init();
  } catch (error) {
    // No teardown is registered for an app that never returned: close what init() opened, report the boot error.
    await app.close().catch(() => undefined);
    throw error;
  }
  return app;
}
