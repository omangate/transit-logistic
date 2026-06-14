import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { FleetOwnershipService } from './fleet-ownership.service';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [AuthModule],
  controllers: [FleetController, VehiclesController, DriversController],
  providers: [FleetService, VehiclesService, DriversService, FleetOwnershipService],
  exports: [FleetService, VehiclesService, DriversService, FleetOwnershipService],
})
export class FleetModule {}
