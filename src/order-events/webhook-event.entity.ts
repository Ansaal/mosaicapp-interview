import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type WebhookEventStatus = 'pending' | 'processed' | 'duplicate' | 'dead';

/** Inbox row: the signed request body exactly as received, waiting for the processor. */
@Entity('webhook_events')
@Index(['status', 'id'])
export class WebhookEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text', { name: 'raw_body' })
  rawBody: string;

  @Column('varchar', { default: 'pending' })
  status: WebhookEventStatus;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;
}
