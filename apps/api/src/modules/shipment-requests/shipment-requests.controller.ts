/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { CreateShipmentRequestDto } from './dto/shipment-request.dto';
import { ShipmentRequestsService } from './shipment-requests.service';

@Controller('shipment-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShipmentRequestsController {
  constructor(private readonly requests: ShipmentRequestsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  create(@CurrentUser() user: User, @Body() dto: CreateShipmentRequestDto) {
    return this.requests.create(user, dto);
  }

  @Get('mine')
  @Roles(UserRole.CUSTOMER)
  listMine(@CurrentUser() user: User) {
    return this.requests.listForCustomer(user);
  }

  @Get('fleet')
  @Roles(UserRole.FLEET_OWNER)
  listForFleet(@CurrentUser() user: User) {
    return this.requests.listForFleet(user);
  }
}
