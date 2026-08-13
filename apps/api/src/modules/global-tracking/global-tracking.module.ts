import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OceanCarriersModule } from '../ocean-carriers/ocean-carriers.module';
import { TrackingModule } from '../tracking/tracking.module';

import { GlobalTrackingController } from './global-tracking.controller';
import { GlobalTrackingService } from './global-tracking.service';
import { AirTrackingProvider } from './providers/air-tracking.provider';
import { RoadTrackingProvider } from './providers/road-tracking.provider';

@Module({
  imports: [AuthModule, OceanCarriersModule, TrackingModule],
  controllers: [GlobalTrackingController],
  providers: [GlobalTrackingService, AirTrackingProvider, RoadTrackingProvider],
  exports: [GlobalTrackingService],
})
export class GlobalTrackingModule {}
