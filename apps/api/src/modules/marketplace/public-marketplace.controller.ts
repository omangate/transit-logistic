import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';

import { MarketplaceBrowseQueryDto } from './dto/marketplace.dto';
import { TruckListingsService } from './truck-listings.service';

@Controller('marketplace')
@Public()
export class PublicMarketplaceController {
  constructor(private readonly listings: TruckListingsService) {}

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
}
