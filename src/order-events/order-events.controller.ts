import { Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { TransactionRunner } from '../database/transaction-runner.js';
import { WebhookEvent } from './webhook-event.entity.js';
import { WebhookSignatureGuard } from './webhook-signature.guard.js';

@Controller('webhooks/orders')
export class OrderEventsController {
  constructor(private readonly transactions: TransactionRunner) {}

  /** Stores the signed body as received and answers before any processing. */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(WebhookSignatureGuard)
  async receive(@Req() req: RawBodyRequest<Request>): Promise<void> {
    // The guard rejected every request without a raw body.
    const rawBody = req.rawBody!.toString('utf8');
    await this.transactions.run((manager) => manager.insert(WebhookEvent, { rawBody }));
  }
}
