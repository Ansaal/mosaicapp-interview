/** Largest delay setInterval/setTimeout accept; above it, and for NaN, Node fires after 1 ms. */
const MAX_TIMER_MS = 2_147_483_647;

/** Reads a timer delay from the environment and fails at startup instead of polling every millisecond. */
export function envMs(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_TIMER_MS) {
    throw new Error(`${name} must be a whole number of milliseconds between 1 and ${MAX_TIMER_MS}, got "${raw}"`);
  }
  return value;
}
