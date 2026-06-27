/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import {
  CreateQuoteRequestDto,
  CreateTruckReviewDto,
  RespondQuoteDto,
} from './dto/marketplace.dto';
import { MarketplaceFavoritesService } from './marketplace-favorites.service';
import { MarketplaceQuotesService } from './marketplace-quotes.service';
import { TruckListingsService } from './truck-listings.service';

@Controller('marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MarketplaceActionsController {
  constructor(
    private readonly quotes: MarketplaceQuotesService,
    private readonly listings: TruckListingsService,
    private readonly favorites: MarketplaceFavoritesService,
  ) {}

  @Post('trucks/:listingId/quotes')
  @Roles(UserRole.CUSTOMER)
  requestQuote(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: CreateQuoteRequestDto,
  ) {
    return this.quotes.create(user, listingId, dto);
  }

  @Get('quotes/mine')
  @Roles(UserRole.CUSTOMER)
  myQuotes(@CurrentUser() user: User) {
    return this.quotes.listForCustomer(user);
  }

  @Get('quotes/fleet')
  @Roles(UserRole.FLEET_OWNER, UserRole.ADMIN)
  fleetQuotes(@CurrentUser() user: User) {
    return this.quotes.listForFleet(user);
  }

  @Patch('quotes/:id/respond')
  @Roles(UserRole.FLEET_OWNER, UserRole.ADMIN)
  respondToQuote(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondQuoteDto,
  ) {
    return this.quotes.respond(user, id, dto);
  }

  @Post('trucks/:listingId/reviews')
  @Roles(UserRole.CUSTOMER)
  createReview(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: CreateTruckReviewDto,
  ) {
    return this.listings.createReview(user, listingId, dto);
  }

  @Get('favorites')
  @Roles(UserRole.CUSTOMER)
  listFavorites(@CurrentUser() user: User) {
    return this.favorites.list(user);
  }

  @Get('favorites/ids')
  @Roles(UserRole.CUSTOMER)
  favoriteIds(@CurrentUser() user: User) {
    return this.favorites.listIds(user);
  }

  @Post('trucks/:listingId/favorite')
  @Roles(UserRole.CUSTOMER)
  addFavorite(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.favorites.add(user, listingId);
  }

  @Delete('trucks/:listingId/favorite')
  @Roles(UserRole.CUSTOMER)
  removeFavorite(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.favorites.remove(user, listingId);
  }
}
