import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configuration } from './config/configuration';
import { PrismaModule } from './database/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EmailModule } from './modules/email/email.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { HealthModule } from './modules/health/health.module';
import { GeographyModule } from './modules/geography/geography.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ShipmentRequestsModule } from './modules/shipment-requests/shipment-requests.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { UsersModule } from './modules/users/users.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    EmailModule,
    HealthModule,
    AuthModule,
    AdminModule,
    UsersModule,
    FleetModule,
    MarketplaceModule,
    GeographyModule,
    ShipmentRequestsModule,
    WalletsModule,
    ShipmentsModule,
    TrackingModule,
    NotificationsModule,
    PricingModule,
    PaymentsModule,
    PayoutsModule,
    DocumentsModule,
    RatingsModule,
    SettingsModule,
  ],
})
export class AppModule {}
