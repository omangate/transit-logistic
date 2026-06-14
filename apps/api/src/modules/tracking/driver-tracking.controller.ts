/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { RecordTrackingPointDto } from './dto/record-tracking-point.dto';
import { TrackingService } from './tracking.service';

@Controller('driver/shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriverTrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post(':id/tracking')
  recordPoint(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordTrackingPointDto,
  ) {
    return this.trackingService.recordPoint(user, id, dto);
  }
}
