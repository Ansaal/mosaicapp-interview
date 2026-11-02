import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A malformed inbox event, kept with every reason it could not be processed. */
@Entity('dead_letter_events')
export class DeadLetterEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('integer', { name: 'webhook_event_id', unique: true })
  webhookEventId: number;

  @Column('text', { name: 'raw_body' })
  rawBody: string;

  /** Stored as a JSON array of strings. */
  @Column('simple-json')
  reasons: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
