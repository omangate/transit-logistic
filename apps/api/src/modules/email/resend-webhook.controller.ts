import { Body, Controller, Headers, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { Public } from '../../common/decorators/public.decorator';

import { EmailDeliveryLogService } from './email-delivery-log.service';

type ResendWebhookPayload = {
  type: string;
  data?: {
    email_id?: string;
    bounce?: { message?: string };
    failed?: { reason?: string };
  };
};

@Controller('webhooks/resend')
export class ResendWebhookController {
  private readonly logger = new Logger(ResendWebhookController.name);

  constructor(
    private readonly deliveryLog: EmailDeliveryLogService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @Public()
  async handle(
    @Body() body: ResendWebhookPayload,
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ) {
    this.verifySignature(JSON.stringify(body), svixId, svixTimestamp, svixSignature);

    const messageId = body.data?.email_id;
    if (!messageId) {
      return { received: true };
    }

    switch (body.type) {
      case 'email.delivered':
        await this.deliveryLog.markDeliveredByProviderMessageId(messageId);
        break;
      case 'email.bounced':
        await this.deliveryLog.markBouncedByProviderMessageId(messageId, body.data?.bounce?.message);
        break;
      case 'email.complained':
        await this.deliveryLog.markComplainedByProviderMessageId(messageId);
        break;
      case 'email.delivery_failed':
      case 'email.failed':
        await this.deliveryLog.markFailedByProviderMessageId(messageId, body.data?.failed?.reason);
        break;
      default:
        this.logger.debug(`Unhandled Resend webhook: ${body.type}`);
    }

    return { received: true };
  }

  private verifySignature(
    payload: string,
    svixId?: string,
    svixTimestamp?: string,
    svixSignature?: string,
  ) {
    const secret = this.config.get<string>('email.resendWebhookSecret');
    if (!secret) {
      return;
    }

    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new UnauthorizedException('Missing webhook signature headers');
    }

    const signed = `${svixId}.${svixTimestamp}.${payload}`;
    const expected = createHmac('sha256', secret).update(signed).digest('base64');
    const signatures = svixSignature.split(' ').map((part) => part.split(',')[1]).filter(Boolean);

    const valid = signatures.some((sig) => {
      try {
        return timingSafeEqual(Buffer.from(sig!), Buffer.from(expected));
      } catch {
        return false;
      }
    });

    if (!valid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
