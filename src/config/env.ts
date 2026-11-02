export interface Env {
  WEBHOOK_SECRET: string;
}

/** ConfigModule `validate`: the app refuses to start without the webhook signing secret. */
export function validateEnv(config: Record<string, unknown>): Env {
  const secret = config.WEBHOOK_SECRET;
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('WEBHOOK_SECRET must be set to the shared webhook signing secret');
  }
  return { WEBHOOK_SECRET: secret };
}
