/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  Body,
  Controller,
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

import { AcceptShipmentDto } from './dto/accept-shipment.dto';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { ShipmentsService } from './shipments.service';

@Controller('fleet/shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FLEET_OWNER)
export class FleetShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get('available')
  findAvailable(@CurrentUser() user: User, @Query() query: ShipmentQueryDto) {
    return this.shipmentsService.findAvailable(user, query);
  }

  @Post(':id/accept')
  accept(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptShipmentDto,
  ) {
    return this.shipmentsService.accept(user, id, dto);
  }
}
