import {
  OceanCarrierCode,
  OceanCarrierIntegrationMode,
  UserRole,
} from '@transit-logistic/shared';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { OceanCarriersService } from './ocean-carriers.service';

@Controller('admin/integrations/ocean-carriers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminOceanCarriersController {
  constructor(private readonly oceanCarriersService: OceanCarriersService) {}

  @Get()
  listConnections() {
    return this.oceanCarriersService.listAdminConnections();
  }

  @Patch(':carrierCode')
  updateConnection(
    @Param('carrierCode') carrierCode: OceanCarrierCode,
    @Body()
    body: {
      enabled?: boolean;
      integrationMode?: OceanCarrierIntegrationMode;
      supportsSchedules?: boolean;
      supportsBooking?: boolean;
    },
  ) {
    return this.oceanCarriersService.updateAdminConnection(carrierCode, body);
  }

  @Post(':carrierCode/test')
  testConnection(@Param('carrierCode') carrierCode: OceanCarrierCode) {
    return this.oceanCarriersService.testAdminConnection(carrierCode);
  }
}
