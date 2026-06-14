/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@transit-logistic/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { AdminFleetService } from './admin-fleet.service';

@Controller('admin/fleet-owners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminFleetController {
  constructor(private readonly fleet: AdminFleetService) {}

  @Get()
  listFleetOwners() {
    return this.fleet.listFleetOwners();
  }
}
