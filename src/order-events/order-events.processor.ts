import { type BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { envMs } from '../common/env-ms.js';
import { isUniqueViolation } from '../database/is-unique-violation.js';
import { TransactionRunner } from '../database/transaction-runner.js';
import { DeadLetterEvent } from './dead-letter-event.entity.js';
import { parseOrderEvent } from './order-event.js';
import { ProcessedEvent } from './processed-event.entity.js';
import { WebhookEvent } from './webhook-event.entity.js';

// Read at import, before any test hook: tests set it in vitest.config.ts `test.env`.
const POLL_MS = envMs('EVENTS_POLL_MS', 5_000);
const BATCH_SIZE = 100;

export interface BatchResult {
  processed: number;
  duplicates: number;
  deadLettered: number;
}

/** Per-event result; `failed` events stay pending and are retried on the next run. */
type Outcome = keyof BatchResult | 'failed';

@Injectable()
export class OrderEventsProcessor implements BeforeApplicationShutdown {
  private readonly logger = new Logger(OrderEventsProcessor.name);
  private running: Promise<BatchResult> | undefined;

  constructor(private readonly transactions: TransactionRunner) {}

  /** Scheduled entry point, nothing else: tests call processPending(). */
  @Interval('order-events:process', POLL_MS)
  async tick(): Promise<void> {
    await this.processPending();
  }

  /** One run per instance: a tick that fires during a run joins it instead of starting a second one. */
  processPending(): Promise<BatchResult> {
    this.running ??= this.processBatch().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  /** app.close() clears the timer but does not wait for a run in progress. */
  async beforeApplicationShutdown(): Promise<void> {
    await this.running?.catch(() => undefined); // a failed run was already logged by the scheduler
  }

  private async processBatch(): Promise<BatchResult> {
    const pending = await this.transactions.run((manager) =>
      manager.find(WebhookEvent, { where: { status: 'pending' }, order: { id: 'ASC' }, take: BATCH_SIZE }),
    );
    if (pending.length === 0) {
      this.logger.debug('No pending order events');
      return { processed: 0, duplicates: 0, deadLettered: 0 };
    }
    const counts: Record<Outcome, number> = { processed: 0, duplicates: 0, deadLettered: 0, failed: 0 };
    for (const event of pending) counts[await this.processOne(event)]++;
    this.logger.log('Processed pending order events', counts);
    return { processed: counts.processed, duplicates: counts.duplicates, deadLettered: counts.deadLettered };
  }

  /** One transaction per event: the outcome row and the inbox status commit together. */
  private async processOne(event: WebhookEvent): Promise<Outcome> {
    try {
      const parsed = parseOrderEvent(event.rawBody);
      if ('reasons' in parsed) return await this.deadLetter(event, parsed.reasons);

      const { eventId, type } = parsed;
      const outcome = await this.transactions.run(async (manager) => {
        try {
          await manager.insert(ProcessedEvent, { eventId, type, payload: event.rawBody, webhookEventId: event.id });
        } catch (error) {
          // SQLite aborts only the failed statement; the transaction goes on to mark the copy.
          if (!isUniqueViolation(error)) throw error;
          await manager.update(WebhookEvent, { id: event.id }, { status: 'duplicate' });
          return 'duplicates' as const;
        }
        await manager.update(WebhookEvent, { id: event.id }, { status: 'processed' });
        return 'processed' as const;
      });
      const fields = { eventId, type, webhookEventId: event.id };
      if (outcome === 'processed') this.logger.log('Order event processed', fields);
      else this.logger.log('Duplicate order event skipped', fields);
      return outcome;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn('Order event failed, retrying on the next run', { webhookEventId: event.id }, err);
      return 'failed';
    }
  }

  /** A malformed event can never succeed: keep it with every reason and take it out of the queue. */
  private async deadLetter(event: WebhookEvent, reasons: string[]): Promise<'deadLettered'> {
    await this.transactions.run(async (manager) => {
      await manager.insert(DeadLetterEvent, { webhookEventId: event.id, rawBody: event.rawBody, reasons });
      await manager.update(WebhookEvent, { id: event.id }, { status: 'dead' });
    });
    this.logger.error('Order event dead-lettered', { webhookEventId: event.id, reasons });
    return 'deadLettered';
  }
}
