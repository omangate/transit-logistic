import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { AvailabilityService } from './availability.service';
import { BookingsService } from './bookings.service';
import {
  BookingQueryDto,
  CreateAvailabilityBlockDto,
  CreateBookingDto,
} from './dto/booking.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly availability: AvailabilityService,
  ) {}

  @Post('bookings')
  @Roles(UserRole.CUSTOMER)
  create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user, dto);
  }

  @Get('bookings')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.ADMIN)
  list(@CurrentUser() user: User, @Query() query: BookingQueryDto) {
    return this.bookings.listForUser(user, query);
  }

  @Get('bookings/:id')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.ADMIN)
  getOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.getById(user, id);
  }

  @Post('bookings/:id/confirm')
  @Roles(UserRole.FLEET_OWNER, UserRole.ADMIN)
  confirm(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.confirm(user, id);
  }

  @Post('bookings/:id/cancel')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.ADMIN)
  cancel(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.cancel(user, id);
  }

  @Post('bookings/:id/convert-shipment')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.ADMIN)
  convertShipment(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.convertToShipment(user, id);
  }

  @Get('marketplace/trucks/:listingId/availability')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.ADMIN)
  listAvailability(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.availability.listForListing(listingId, from, to);
  }

  @Post('fleet/marketplace/trucks/:listingId/availability')
  @Roles(UserRole.FLEET_OWNER, UserRole.ADMIN)
  createBlock(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: CreateAvailabilityBlockDto,
  ) {
    return this.availability.createBlock(user, listingId, dto);
  }

  @Delete('fleet/marketplace/trucks/:listingId/availability/:blockId')
  @Roles(UserRole.FLEET_OWNER, UserRole.ADMIN)
  deleteBlock(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ) {
    return this.availability.deleteBlock(user, listingId, blockId);
  }
}
