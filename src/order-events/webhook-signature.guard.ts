import { createHmac, timingSafeEqual } from 'node:crypto';
import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { Env } from '../config/env.js';

/** Accepts only requests whose `x-signature` is the lowercase hex HMAC-SHA256 of the raw body. */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly secret: string;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get('WEBHOOK_SECRET', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = req.headers['x-signature'];
    // No raw body (not JSON, or empty): there is nothing the signature could cover.
    if (typeof signature !== 'string' || !req.rawBody) throw new UnauthorizedException('Invalid signature');

    const expected = Buffer.from(createHmac('sha256', this.secret).update(req.rawBody).digest('hex'));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException('Invalid signature');
    }
    return true;
  }
}
