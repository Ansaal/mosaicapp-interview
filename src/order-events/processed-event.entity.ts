import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** One row per upstream event_id: the primary key is the dedupe guard. */
@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryColumn('varchar', { name: 'event_id' })
  eventId: string;

  @Column('varchar')
  type: string;

  /** The full event body as received. */
  @Column('text')
  payload: string;

  @Column('integer', { name: 'webhook_event_id' })
  webhookEventId: number;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}
