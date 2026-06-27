import { Module } from '@nestjs/common';

import { FleetModule } from '../fleet/fleet.module';

import { AdminMarketplaceController } from './admin-marketplace.controller';
import { FleetTruckListingsController } from './fleet-truck-listings.controller';
import { MarketplaceActionsController } from './marketplace-actions.controller';
import { MarketplaceFavoritesService } from './marketplace-favorites.service';
import { MarketplaceQuotesService } from './marketplace-quotes.service';
import { PublicMarketplaceController } from './public-marketplace.controller';
import { TruckListingsService } from './truck-listings.service';

@Module({
  imports: [FleetModule],
  controllers: [
    PublicMarketplaceController,
    FleetTruckListingsController,
    MarketplaceActionsController,
    AdminMarketplaceController,
  ],
  providers: [TruckListingsService, MarketplaceQuotesService, MarketplaceFavoritesService],
  exports: [TruckListingsService],
})
export class MarketplaceModule {}
