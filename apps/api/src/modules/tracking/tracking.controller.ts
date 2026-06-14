/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { TrackingQueryDto } from './dto/tracking-query.dto';
import { TrackingService } from './tracking.service';

@Controller('shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get(':id/tracking/live')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  getLive(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trackingService.getLivePosition(user, id);
  }

  @Get(':id/tracking/geofence-events')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  getGeofenceEvents(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TrackingQueryDto,
  ) {
    return this.trackingService.getGeofenceEvents(user, id, query);
  }

  @Get(':id/tracking')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  getHistory(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TrackingQueryDto,
  ) {
    return this.trackingService.getHistory(user, id, query);
  }
}
