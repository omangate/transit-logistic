import { IsIn, IsOptional, IsString } from 'class-validator';

import { PAYMENT_CALLBACK_LOCALES } from '../payment-callback-url.util';

export class CreatePaymentIntentDto {
  @IsOptional()
  @IsString()
  @IsIn(PAYMENT_CALLBACK_LOCALES)
  locale?: string;
}
