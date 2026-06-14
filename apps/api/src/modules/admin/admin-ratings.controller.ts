/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@transit-logistic/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RatingsService } from '../ratings/ratings.service';

@Controller('admin/ratings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminRatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Get()
  listRatings(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.ratings.listAllForAdmin({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
