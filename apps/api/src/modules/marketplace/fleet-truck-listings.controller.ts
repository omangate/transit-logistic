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
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import {
  CreateTruckListingDto,
  SetCoverImageDto,
  UpdateTruckListingDto,
} from './dto/marketplace.dto';
import { TruckListingsService } from './truck-listings.service';

@Controller('fleet/marketplace/trucks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FLEET_OWNER, UserRole.ADMIN)
export class FleetTruckListingsController {
  constructor(private readonly listings: TruckListingsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateTruckListingDto) {
    return this.listings.createForFleet(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.listings.findAllForFleet(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.findOneForFleet(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTruckListingDto,
  ) {
    return this.listings.updateForFleet(user, id, dto);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.submitForApproval(user, id);
  }

  @Post(':id/cover')
  setCover(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCoverImageDto,
  ) {
    return this.listings.setCoverImage(user, id, dto.imageUrl);
  }
}
