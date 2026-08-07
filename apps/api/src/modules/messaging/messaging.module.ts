import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FleetModule } from '../fleet/fleet.module';

import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [AuthModule, FleetModule],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
