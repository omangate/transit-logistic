/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { UpdateFleetProfileDto } from './dto/update-fleet-profile.dto';
import { FleetService } from './fleet.service';

@Controller('fleet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FLEET_OWNER)
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return this.fleetService.getProfile(user);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateFleetProfileDto) {
    return this.fleetService.updateProfile(user, dto);
  }
}
