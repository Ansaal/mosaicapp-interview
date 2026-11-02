import { createHmac } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { CapturingLogger } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { OrderEventsProcessor } from '../src/order-events/order-events.processor.js';
import { createTestApp } from './support/test-app.js';

interface ProcessedRow {
  event_id: string;
  type: string;
  payload: string;
}

interface DeadLetterRow {
  webhook_event_id: number;
  raw_body: string;
  reasons: string;
}

/** Signs like upstream: lowercase hex HMAC-SHA256 of the exact body bytes. */
const sign = (raw: string) => createHmac('sha256', process.env.WEBHOOK_SECRET!).update(raw).digest('hex');

let logs: CapturingLogger;
let app: NestExpressApplication;

// A fresh app, migrated :memory: database and logger per test.
beforeEach(async () => {
  logs = new CapturingLogger();
  app = await createTestApp(undefined, { logger: logs });
  return () => app.close();
});

const postEvent = (raw: string, signature?: string, contentType = 'application/json') => {
  const req = request(app.getHttpServer()).post('/webhooks/orders').set('content-type', contentType);
  return (signature === undefined ? req : req.set('x-signature', signature)).send(raw);
};

const processedRows = async () => {
  const rows = await app
    .get(DataSource)
    .query<ProcessedRow[]>('SELECT event_id, type, payload FROM processed_events ORDER BY rowid');
  return rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) as unknown }));
};

const deadLetterRows = async () => {
  const rows = await app
    .get(DataSource)
    .query<DeadLetterRow[]>('SELECT webhook_event_id, raw_body, reasons FROM dead_letter_events ORDER BY id');
  return rows.map((row) => ({ ...row, reasons: JSON.parse(row.reasons) as unknown }));
};

describe('Process the order event of a signed webhook', () => {
  it('answers 202 and records the event once processed', async () => {
    const event = { event_id: 'evt_1', type: 'order.created', data: { orderId: 'ord_1', total: 42 } };
    const raw = JSON.stringify(event);

    await postEvent(raw, sign(raw)).expect(202);
    await app.get(OrderEventsProcessor).processPending();

    expect(await processedRows()).toEqual([{ event_id: 'evt_1', type: 'order.created', payload: event }]);
    logs.assertLogged({
      level: 'log',
      context: 'OrderEventsProcessor',
      message: 'Order event processed',
      params: { eventId: 'evt_1', type: 'order.created' },
    });
  });

  it('records a repeated event_id only once', async () => {
    const first = { event_id: 'evt_1', type: 'order.created', data: { total: 42 } };
    const resent = { ...first, data: { total: 99 } };
    const processor = app.get(OrderEventsProcessor);

    // Duplicate inside one batch, then a changed copy in a later batch: the first processed wins.
    await postEvent(JSON.stringify(first), sign(JSON.stringify(first))).expect(202);
    await postEvent(JSON.stringify(first), sign(JSON.stringify(first))).expect(202);
    expect(await processor.processPending()).toEqual({ processed: 1, duplicates: 1, deadLettered: 0 });
    await postEvent(JSON.stringify(resent), sign(JSON.stringify(resent))).expect(202);
    expect(await processor.processPending()).toEqual({ processed: 0, duplicates: 1, deadLettered: 0 });

    expect(await processedRows()).toEqual([{ event_id: 'evt_1', type: 'order.created', payload: first }]);
  });

  it('answers 401 Invalid signature and stores nothing', async () => {
    const raw = JSON.stringify({ event_id: 'evt_1', type: 'order.created', data: { total: 42 } });
    const tampered = raw.replace('42', '4200');

    const wrong = await postEvent(tampered, sign(raw)).expect(401);
    const missing = await postEvent(raw).expect(401);

    expect([wrong.body, missing.body]).toEqual([
      expect.objectContaining({ message: 'Invalid signature' }),
      expect.objectContaining({ message: 'Invalid signature' }),
    ]);
    const [{ count }] = await app
      .get(DataSource)
      .query<[{ count: number }]>('SELECT COUNT(*) AS count FROM webhook_events');
    expect(count).toBe(0);
  });
});

describe('Dead-letter the malformed event of a webhook', () => {
  it('stores every reason an event is malformed and never retries it', async () => {
    const raw = JSON.stringify({ type: 42, data: { orderId: 'ord_1' } });
    const reasons = ['event_id is missing', 'type must be a non-empty string'];
    const processor = app.get(OrderEventsProcessor);

    await postEvent(raw, sign(raw)).expect(202);
    expect(await processor.processPending()).toEqual({ processed: 0, duplicates: 0, deadLettered: 1 });
    expect(await processor.processPending()).toEqual({ processed: 0, duplicates: 0, deadLettered: 0 });

    expect(await deadLetterRows()).toEqual([{ webhook_event_id: 1, raw_body: raw, reasons }]);
    expect(await processedRows()).toEqual([]);
    logs.assertLogged({
      level: 'error',
      context: 'OrderEventsProcessor',
      message: 'Order event dead-lettered',
      params: { webhookEventId: 1, reasons },
    });
  });

  it('dead-letters a body that is not a JSON object', async () => {
    const raw = JSON.stringify([{ event_id: 'evt_1', type: 'order.created' }]);

    await postEvent(raw, sign(raw)).expect(202);
    expect(await app.get(OrderEventsProcessor).processPending()).toEqual({
      processed: 0,
      duplicates: 0,
      deadLettered: 1,
    });

    expect(await deadLetterRows()).toEqual([
      { webhook_event_id: 1, raw_body: raw, reasons: ['body is not a JSON object'] },
    ]);
  });

  it('dead-letters a signed form body that is not JSON', async () => {
    const raw = 'event_id=evt_1&type=order.created';

    await postEvent(raw, sign(raw), 'application/x-www-form-urlencoded').expect(202);
    expect(await app.get(OrderEventsProcessor).processPending()).toEqual({
      processed: 0,
      duplicates: 0,
      deadLettered: 1,
    });

    expect(await deadLetterRows()).toEqual([
      { webhook_event_id: 1, raw_body: raw, reasons: ['body is not valid JSON'] },
    ]);
  });
});
