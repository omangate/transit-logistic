import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';

import { EmailDeliveryLogService } from './email-delivery-log.service';
import { EmailPreferencesService } from './email-preferences.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailService } from './email.service';
import { AdminEmailController } from './admin-email.controller';
import { AdminNotificationRecipientsService } from './admin-notification-recipients.service';
import { ResendWebhookConfigService } from './resend-webhook-config.service';
import { ResendWebhookController } from './resend-webhook.controller';
import { TransactionalEmailService } from './transactional-email.service';

@Global()
@Module({
  imports: [SettingsModule, AuthModule],
  controllers: [ResendWebhookController, AdminEmailController],
  providers: [
    EmailService,
    EmailDeliveryLogService,
    EmailPreferencesService,
    AdminNotificationRecipientsService,
    ResendWebhookConfigService,
    TransactionalEmailService,
    EmailVerificationService,
  ],
  exports: [
    EmailService,
    EmailDeliveryLogService,
    EmailPreferencesService,
    AdminNotificationRecipientsService,
    ResendWebhookConfigService,
    TransactionalEmailService,
    EmailVerificationService,
  ],
})
export class EmailModule {}
