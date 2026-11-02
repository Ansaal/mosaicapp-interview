# PLAN: Order webhook inbox

## Decisions

- D1 `POST /webhooks/orders`, body `{ event_id: string, type: string, ...data }` — upstream contract
- D2 `x-signature` = lowercase hex HMAC-SHA256 of the raw body with `WEBHOOK_SECRET`; bad or missing → 401, nothing stored
- D3 Invalid JSON → 400 from body-parser; any signed body is stored raw → 202; checked only at processing
- D7 Malformed (not JSON, not an object, `event_id`/`type` missing or not a non-empty string) → dead-letter row with every reason as a JSON array `reasons`, inbox `dead`, never retried — your call
- D4 Dedupe at processing via `UNIQUE(event_id)`; first processed wins, later copies are marked `duplicate`
- D5 `@Interval` every `EVENTS_POLL_MS` (default 5000), oldest 100 `pending`, single-flight — instead of `@Cron`, which allows at most one run per second
- D6 One transaction per event (outcome row + inbox status); other errors leave the event `pending` for the next tick

## Risks

- Body-parser runs before the signature check (unsigned invalid JSON → 400, not 401); no replay protection — accepted
- SQLite single writer, one instance, no locks; upstream never learns of dead letters — accepted; `UNIQUE(event_id)` still blocks double processing

## Model

- R1 "receive incoming webhook events" / R2 "validates an x-signature header against a shared secret hmac" / R3 "writes the events as they are into a database table and immediately returns 202" → F1
- R4 "cron job to pick up the latest events" / R5 "writing to a processed_events table and logging it" / R6 "event_id that we need to dedupe on" → F1; R7 "malformed events go into a DLT" → F2
- WebhookEvent (entity): id, raw_body, status pending|processed|duplicate|dead, received_at → OrderEvents
- ProcessedEvent (entity): event_id unique, type, payload, processed_at; from 1 WebhookEvent → OrderEvents
- DeadLetterEvent (entity): webhook_event_id unique, raw_body, reasons string[], created_at; from 1 WebhookEvent → OrderEvents
- I1 an event_id is processed at most once (R6) — owner ProcessedEvent; I2 only correctly signed requests are stored (R2) — owner WebhookEvent
- I3 a malformed event is never processed and is dead-lettered once, with every reason (R7) — owner DeadLetterEvent
- Out of scope: DLT replay, multi-instance locks, replay protection

## Enablers

- [x] **E1 Nest 12 ESM toolchain, JSON logger, shared `rawBody` options, `createTestApp()`** — check: `pnpm typecheck && pnpm lint && pnpm build && node dist/main.js` → "Nest application successfully started"
- [x] **E2 TypeORM 1.x + better-sqlite3 data source, migration scripts, app-wide `TransactionRunner` (one shared connection)** — check: `pnpm migration:check` → no changes
- [x] **E3 ScheduleModule, `envMs()`, ConfigModule requiring `WEBHOOK_SECRET`** — check: boot without it → exits naming `WEBHOOK_SECRET`

## Features — OrderEventsModule (owns WebhookEvent, ProcessedEvent, DeadLetterEvent; exports nothing)

- [x] **F1 Process the order event of a signed webhook**
  - Interface: `POST /webhooks/orders` + `x-signature` → 202; 401 `Invalid signature`; `OrderEventsProcessor.processPending(): Promise<BatchResult>`
  - Data: writes webhook_events, processed_events; migration. Operations: interval, single-flight (D5); one transaction per event (D6); logs event processed / duplicate skipped: log, empty tick: debug
  - Test: e2e `test/order-events.e2e-spec.ts` — `describe('Process the order event of a signed webhook')`
    - `it('answers 202 and records the event once processed')`
    - `it('records a repeated event_id only once')` — I1
    - `it('answers 401 Invalid signature and stores nothing')` — I2
- [x] **F2 Dead-letter the malformed event of a webhook**
  - Interface: `BatchResult` gains `deadLettered`; logs "Order event dead-lettered" at error with `reasons`
  - Data: writes dead_letter_events, webhook_events; migration
  - Test: e2e `test/order-events.e2e-spec.ts` — `describe('Dead-letter the malformed event of a webhook')`
    - `it('stores every reason an event is malformed and never retries it')` — I3
    - `it('dead-letters a body that is not a JSON object')` — I3
    - `it('dead-letters a signed form body that is not JSON')` — I3
