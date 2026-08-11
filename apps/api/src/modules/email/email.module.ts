import { Global, Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';

import { EmailDeliveryLogService } from './email-delivery-log.service';
import { EmailPreferencesService } from './email-preferences.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailService } from './email.service';
import { ResendWebhookController } from './resend-webhook.controller';
import { TransactionalEmailService } from './transactional-email.service';

@Global()
@Module({
  imports: [SettingsModule],
  controllers: [ResendWebhookController],
  providers: [
    EmailService,
    EmailDeliveryLogService,
    EmailPreferencesService,
    TransactionalEmailService,
    EmailVerificationService,
  ],
  exports: [
    EmailService,
    EmailDeliveryLogService,
    EmailPreferencesService,
    TransactionalEmailService,
    EmailVerificationService,
  ],
})
export class EmailModule {}
