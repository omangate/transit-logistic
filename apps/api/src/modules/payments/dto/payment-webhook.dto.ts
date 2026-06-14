import { IsObject, IsString } from 'class-validator';

export class PaymentWebhookDto {
  @IsString()
  type!: string;

  @IsString()
  providerIntentId!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
