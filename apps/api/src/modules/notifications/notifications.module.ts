import { forwardRef, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';

import { AdminNotificationsController } from './admin-notifications.controller';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [forwardRef(() => AuthModule), SettingsModule],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [NotificationsService, NotificationDeliveryService],
  exports: [NotificationsService, NotificationDeliveryService],
})
export class NotificationsModule {}
