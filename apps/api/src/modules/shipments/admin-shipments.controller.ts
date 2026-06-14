/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { AssignShipmentDto } from './dto/assign-shipment.dto';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ShipmentsService } from './shipments.service';

@Controller('admin/shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: ShipmentQueryDto) {
    return this.shipmentsService.findAll(user, query);
  }

  @Get('export/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="shipments.csv"')
  async exportCsv(@CurrentUser() user: User, @Query() query: ShipmentQueryDto, @Res() res: Response) {
    const csv = await this.shipmentsService.exportShipmentsCsv(user, query);
    res.send(csv);
  }

  @Get('export/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="shipments.pdf"')
  async exportPdf(@CurrentUser() user: User, @Query() query: ShipmentQueryDto, @Res() res: Response) {
    const pdf = await this.shipmentsService.exportShipmentsPdf(user, query);
    res.send(pdf);
  }

  @Post(':id/assign')
  assign(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignShipmentDto,
  ) {
    return this.shipmentsService.adminAssign(user, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipmentStatusDto,
  ) {
    return this.shipmentsService.adminUpdateStatus(user, id, dto.status, dto.note);
  }
}
