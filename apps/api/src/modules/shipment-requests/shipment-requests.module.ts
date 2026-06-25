import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { ShipmentRequestsController } from './shipment-requests.controller';
import { ShipmentRequestsService } from './shipment-requests.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ShipmentRequestsController],
  providers: [ShipmentRequestsService],
  exports: [ShipmentRequestsService],
})
export class ShipmentRequestsModule {}
