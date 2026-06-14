/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ShipmentsService } from './shipments.service';

@Controller('shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  create(@CurrentUser() user: User, @Body() dto: CreateShipmentDto) {
    return this.shipmentsService.create(user, dto);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  findAll(@CurrentUser() user: User, @Query() query: ShipmentQueryDto) {
    return this.shipmentsService.findAll(user, query);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shipmentsService.findOne(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.CUSTOMER)
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.shipmentsService.update(user, id, dto);
  }

  @Post(':id/confirm')
  @Roles(UserRole.CUSTOMER)
  confirm(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shipmentsService.confirm(user, id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  cancel(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shipmentsService.cancel(user, id);
  }

  @Post(':id/complete')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  complete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shipmentsService.complete(user, id);
  }

  @Get(':id/timeline')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  getTimeline(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shipmentsService.getTimeline(user, id);
  }
}
