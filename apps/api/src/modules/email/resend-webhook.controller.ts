import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';

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

type RawBodyRequest = {
  rawBody?: Buffer;
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
    @Req() req: RawBodyRequest,
    @Body() parsedBody: ResendWebhookPayload,
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ) {
    const secret = this.config.get<string>('email.resendWebhookSecret');
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    const body = secret
      ? this.verifyPayload(rawBody, { svixId, svixTimestamp, svixSignature }, secret)
      : parsedBody;

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

  private verifyPayload(
    rawBody: string,
    headers: { svixId?: string; svixTimestamp?: string; svixSignature?: string },
    secret: string,
  ): ResendWebhookPayload {
    if (!rawBody) {
      throw new UnauthorizedException('Missing webhook payload');
    }

    if (!headers.svixId || !headers.svixTimestamp || !headers.svixSignature) {
      throw new UnauthorizedException('Missing webhook signature headers');
    }

    try {
      const verifier = new Webhook(secret);
      return verifier.verify(rawBody, {
        'svix-id': headers.svixId,
        'svix-timestamp': headers.svixTimestamp,
        'svix-signature': headers.svixSignature,
      }) as ResendWebhookPayload;
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
