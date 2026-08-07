import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';

import { AvailabilityService } from '../bookings/availability.service';

import { MarketplaceBrowseQueryDto } from './dto/marketplace.dto';
import { SmartSearchService } from './smart-search.service';
import { TruckListingsService } from './truck-listings.service';

@Controller('marketplace')
@Public()
export class PublicMarketplaceController {
  constructor(
    private readonly listings: TruckListingsService,
    private readonly availability: AvailabilityService,
    private readonly smartSearchService: SmartSearchService,
  ) {}

  @Get('trucks')
  browse(@Query() query: MarketplaceBrowseQueryDto) {
    return this.listings.browsePublic(query);
  }

  @Get('trucks/:slug/similar')
  similar(@Param('slug') slug: string) {
    return this.listings.getSimilarTrucks(slug);
  }

  @Get('trucks/:slug')
  getBySlug(
    @Param('slug') slug: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.listings.getPublicBySlug(slug, sessionId);
  }

  @Get('home')
  homeSections() {
    return this.listings.getHomeSections();
  }

  @Get('smart-search')
  smartSearch(@Query('q') q: string) {
    return this.smartSearchService.search(q ?? '');
  }

  @Get('listings/:listingId/availability')
  listingAvailability(
    @Param('listingId') listingId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.availability.listForListing(listingId, from, to);
  }
}
