import { Controller, Get, UseGuards } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { FleetLogisticsService } from './fleet-logistics.service';

@Controller('fleet/logistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FLEET_OWNER)
export class FleetLogisticsController {
  constructor(private readonly fleetLogistics: FleetLogisticsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: User) {
    return this.fleetLogistics.getDashboard(user);
  }
}
