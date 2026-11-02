import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    // One config: `vitest run -t '<name>'` reaches unit specs and e2e suites alike.
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // Test-only settings, applied before any test file imports the app.
    env: {
      DB_PATH: ':memory:',
      NEST_LOG_LEVEL: process.env.NEST_LOG_LEVEL || 'fatal',
      WEBHOOK_SECRET: 'test-webhook-secret',
      // Parks the processing interval; tests call the work method directly.
      EVENTS_POLL_MS: '3600000',
    },
  },
  // SWC compiles the tests exactly like `nest build` does, decorator metadata included.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
