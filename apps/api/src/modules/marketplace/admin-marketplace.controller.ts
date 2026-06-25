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
import { TruckListingStatus } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { AdminModerateListingDto } from './dto/marketplace.dto';
import { TruckListingsService } from './truck-listings.service';

@Controller('admin/marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminMarketplaceController {
  constructor(private readonly listings: TruckListingsService) {}

  @Get('metrics')
  metrics() {
    return this.listings.getAdminMetrics();
  }

  @Get('trucks')
  list(@Query('status') status?: TruckListingStatus) {
    return this.listings.adminList(status);
  }

  @Post('trucks/:id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.adminApprove(id);
  }

  @Post('trucks/:id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminModerateListingDto,
  ) {
    return this.listings.adminReject(id, dto.rejectionReason ?? 'Rejected by admin');
  }

  @Post('trucks/:id/suspend')
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.adminSuspend(id);
  }

  @Patch('trucks/:id')
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminModerateListingDto,
  ) {
    if (dto.isFeatured !== undefined) {
      return this.listings.adminSetFeatured(id, dto.isFeatured);
    }
    if (dto.isListingEnabled !== undefined) {
      return this.listings.adminSetListingEnabled(id, dto.isListingEnabled);
    }
    return this.listings.adminGetOne(id);
  }

  @Patch('reviews/:id/visibility')
  moderateReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isVisible') isVisible: boolean,
  ) {
    return this.listings.adminModerateReview(id, isVisible);
  }
}
