import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FleetModule } from '../fleet/fleet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';
import { WalletsModule } from '../wallets/wallets.module';

import { AdminShipmentsController } from './admin-shipments.controller';
import { DriverShipmentsController } from './driver-shipments.controller';
import { FleetShipmentsController } from './fleet-shipments.controller';
import { ShipmentAccessService } from './shipment-access.service';
import { ShipmentCommerceController } from './shipment-commerce.controller';
import { ShipmentCommerceService } from './shipment-commerce.service';
import { ShipmentStateService } from './shipment-state.service';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';

@Module({
  imports: [AuthModule, FleetModule, WalletsModule, NotificationsModule, PricingModule],
  controllers: [
    ShipmentsController,
    FleetShipmentsController,
    DriverShipmentsController,
    AdminShipmentsController,
    ShipmentCommerceController,
  ],
  providers: [ShipmentsService, ShipmentAccessService, ShipmentStateService, ShipmentCommerceService],
  exports: [ShipmentsService, ShipmentAccessService, ShipmentCommerceService],
})
export class ShipmentsModule {}
