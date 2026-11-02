import { QueryFailedError } from 'typeorm';

const UNIQUE_CODES: ReadonlySet<unknown> = new Set(['SQLITE_CONSTRAINT_UNIQUE', 'SQLITE_CONSTRAINT_PRIMARYKEY']);

/** True when a write failed on a UNIQUE or PRIMARY KEY constraint (better-sqlite3). */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    UNIQUE_CODES.has(driverError.code)
  );
}
