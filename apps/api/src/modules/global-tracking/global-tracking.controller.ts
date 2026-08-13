import { GlobalTrackingSearchType, TrackingMode, UserRole } from '@transit-logistic/shared';
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { GlobalTrackingService } from './global-tracking.service';

import type { Request } from 'express';

type AuthRequest = Request & { user?: { id: string; role: UserRole } };

@Controller('global')
export class GlobalTrackingController {
  constructor(private readonly globalTracking: GlobalTrackingService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('track')
  track(
    @Query('mode') mode?: TrackingMode | 'all',
    @Query('type') type?: string,
    @Query('value') value?: string,
    @Req() req?: AuthRequest,
  ) {
    const searchValue = value?.trim() ?? '';
    const searchType = this.parseSearchType(type);
    return this.globalTracking.track({
      mode: mode ?? 'all',
      searchType,
      searchValue,
      requesterUserId: req?.user?.id,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.FLEET_OWNER, UserRole.DRIVER)
  @Get('tracking/summary')
  summary(@Req() req: AuthRequest) {
    return this.globalTracking.getSummary(req.user!.id);
  }

  private parseSearchType(type?: string): GlobalTrackingSearchType | undefined {
    const values = Object.values(GlobalTrackingSearchType);
    if (type && values.includes(type as GlobalTrackingSearchType)) {
      return type as GlobalTrackingSearchType;
    }
    return undefined;
  }
}
