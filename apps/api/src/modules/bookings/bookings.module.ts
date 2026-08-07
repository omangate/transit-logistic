import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FleetModule } from '../fleet/fleet.module';

import { AvailabilityService } from './availability.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule, FleetModule],
  controllers: [BookingsController],
  providers: [BookingsService, AvailabilityService],
  exports: [BookingsService, AvailabilityService],
})
export class BookingsModule {}
