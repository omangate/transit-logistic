import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { FleetModule } from '../fleet/fleet.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { AdminMarketplaceController } from './admin-marketplace.controller';
import { FleetTruckListingsController } from './fleet-truck-listings.controller';
import { MarketplaceActionsController } from './marketplace-actions.controller';
import { MarketplaceFavoritesService } from './marketplace-favorites.service';
import { MarketplaceQuotesService } from './marketplace-quotes.service';
import { PublicMarketplaceController } from './public-marketplace.controller';
import { SmartSearchService } from './smart-search.service';
import { TruckListingsService } from './truck-listings.service';
import { TruckMediaController } from './truck-media.controller';
import { TruckMediaService } from './truck-media.service';

@Module({
  imports: [AuthModule, FleetModule, NotificationsModule, forwardRef(() => BookingsModule)],
  controllers: [
    PublicMarketplaceController,
    FleetTruckListingsController,
    TruckMediaController,
    MarketplaceActionsController,
    AdminMarketplaceController,
  ],
  providers: [
    TruckListingsService,
    MarketplaceQuotesService,
    MarketplaceFavoritesService,
    TruckMediaService,
    SmartSearchService,
  ],
  exports: [TruckListingsService, SmartSearchService],
})
export class MarketplaceModule {}
