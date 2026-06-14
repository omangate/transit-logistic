import { Module } from '@nestjs/common';



import { RatingsModule } from '../ratings/ratings.module';

import { ShipmentsModule } from '../shipments/shipments.module';



import { AdminCustomersController } from './admin-customers.controller';

import { AdminCustomersService } from './admin-customers.service';

import { AdminDashboardController } from './admin-dashboard.controller';

import { AdminDashboardService } from './admin-dashboard.service';

import { AdminFleetController } from './admin-fleet.controller';

import { AdminFleetService } from './admin-fleet.service';

import { AdminRatingsController } from './admin-ratings.controller';



@Module({

  imports: [ShipmentsModule, RatingsModule],

  controllers: [

    AdminDashboardController,

    AdminFleetController,

    AdminCustomersController,

    AdminRatingsController,

  ],

  providers: [AdminDashboardService, AdminFleetService, AdminCustomersService],

})

export class AdminModule {}

