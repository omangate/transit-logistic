/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
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

import { ShipmentsService } from './shipments.service';

@Controller('driver/shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriverShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get('active')
  getActive(@CurrentUser() user: User) {
    return this.shipmentsService.getActiveForDriver(user);
  }

  @Post(':id/pickup')
  pickup(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shipmentsService.driverPickup(user, id);
  }

  @Post(':id/start-transit')
  startTransit(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shipmentsService.driverStartTransit(user, id);
  }

  @Post(':id/deliver')
  deliver(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shipmentsService.driverDeliver(user, id);
  }
}
