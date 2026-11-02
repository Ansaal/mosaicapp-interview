import type { NestApplicationOptions } from '@nestjs/common';

/** Create options main.ts and createTestApp() share. `rawBody` keeps the exact bytes the webhook signature covers. */
export const appOptions = { rawBody: true } as const satisfies NestApplicationOptions;
