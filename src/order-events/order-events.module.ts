import { Module } from '@nestjs/common';
import { OrderEventsController } from './order-events.controller.js';
import { OrderEventsProcessor } from './order-events.processor.js';
import { WebhookSignatureGuard } from './webhook-signature.guard.js';

@Module({
  controllers: [OrderEventsController],
  providers: [OrderEventsProcessor, WebhookSignatureGuard],
})
export class OrderEventsModule {}
