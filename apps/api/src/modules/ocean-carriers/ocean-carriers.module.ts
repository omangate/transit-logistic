import { Module } from '@nestjs/common';

import { AdminOceanCarriersController } from './admin-ocean-carriers.controller';
import { OceanCarriersController } from './ocean-carriers.controller';
import { OceanCarriersService } from './ocean-carriers.service';
import { InternalOceanTrackingProvider } from './providers/internal-ocean-tracking.provider';

@Module({
  controllers: [OceanCarriersController, AdminOceanCarriersController],
  providers: [OceanCarriersService, InternalOceanTrackingProvider],
  exports: [OceanCarriersService],
})
export class OceanCarriersModule {}
