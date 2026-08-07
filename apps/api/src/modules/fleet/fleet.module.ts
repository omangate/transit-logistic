import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import {
  AdminFleetDocumentsController,
  FleetDocumentsController,
} from './fleet-documents.controller';
import { FleetDocumentsService } from './fleet-documents.service';
import { FleetOwnershipService } from './fleet-ownership.service';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [
    FleetController,
    VehiclesController,
    DriversController,
    FleetDocumentsController,
    AdminFleetDocumentsController,
  ],
  providers: [
    FleetService,
    VehiclesService,
    DriversService,
    FleetOwnershipService,
    FleetDocumentsService,
  ],
  exports: [FleetService, VehiclesService, DriversService, FleetOwnershipService],
})
export class FleetModule {}
