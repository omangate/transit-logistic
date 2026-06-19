/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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

import { CreatePayoutRequestDto } from './dto/create-payout-request.dto';
import { PayoutQueryDto } from './dto/payout-query.dto';
import { PayoutsService } from './payouts.service';

@Controller('payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FLEET_OWNER)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreatePayoutRequestDto) {
    return this.payoutsService.createRequest(user, dto);
  }

  @Get('summary')
  summary(@CurrentUser() user: User) {
    return this.payoutsService.getMySummary(user);
  }

  @Get()
  list(@CurrentUser() user: User, @Query() query: PayoutQueryDto) {
    return this.payoutsService.listMyPayouts(user, query);
  }

  @Get(':id')
  getById(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.payoutsService.getMyPayout(user, id);
  }
}
