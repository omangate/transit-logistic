import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShipmentsModule } from '../shipments/shipments.module';

import { DriverTrackingController } from './driver-tracking.controller';
import { PublicTrackingController } from './public-tracking.controller';
import { TrackingAuthService } from './tracking-auth.service';
import { TrackingCacheService } from './tracking-cache.service';
import { TrackingController } from './tracking.controller';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';

@Module({
  imports: [AuthModule, ShipmentsModule, NotificationsModule],
  controllers: [TrackingController, DriverTrackingController, PublicTrackingController],
  providers: [
    TrackingService,
    TrackingCacheService,
    TrackingGateway,
    TrackingAuthService,
  ],
  exports: [TrackingService, TrackingCacheService, TrackingGateway],
})
export class TrackingModule {}
