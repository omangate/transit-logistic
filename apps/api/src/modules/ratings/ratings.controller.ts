import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { type CreateRatingDto } from './dto/create-rating.dto';
import { type RatingsService } from './ratings.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post('shipments/:shipmentId/rating')
  @Roles(UserRole.CUSTOMER)
  create(
    @CurrentUser() user: User,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratings.createRating(user, shipmentId, dto);
  }

  @Get('shipments/:shipmentId/rating')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.ADMIN)
  getForShipment(
    @CurrentUser() user: User,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
  ) {
    return this.ratings.getShipmentRating(user, shipmentId);
  }

  @Get('fleet/ratings')
  @Roles(UserRole.FLEET_OWNER)
  getFleetSummary(@CurrentUser() user: User) {
    return this.ratings.getFleetSummary(user);
  }
}
