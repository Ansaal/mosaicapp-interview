import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

interface ActiveTransaction {
  /** Cleared when the outer work settles, so contexts that outlive the transaction hold no manager. */
  manager?: EntityManager;
}

/**
 * better-sqlite3 gives a DataSource one shared connection, so transactions run one at a time:
 * a statement issued elsewhere while a transaction is open would run (and roll back) inside it.
 * A run() inside an open transaction joins it instead of queueing behind it.
 */
@Injectable()
export class TransactionRunner {
  private readonly active = new AsyncLocalStorage<ActiveTransaction>();
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    // `.then(work)`: a synchronous throw in work rejects the returned promise on both paths.
    const joined = this.active.getStore()?.manager;
    if (joined) return Promise.resolve(joined).then(work);

    const result = this.tail.then(() =>
      this.dataSource.transaction((manager) => {
        const transaction: ActiveTransaction = { manager };
        return this.active
          .run(transaction, () => Promise.resolve(manager).then(work))
          .finally(() => {
            transaction.manager = undefined;
          });
      }),
    );
    this.tail = result.catch(() => undefined);
    return result;
  }
}
