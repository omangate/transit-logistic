/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { AdminPayoutQueryDto } from './dto/admin-payout-query.dto';
import { RejectPayoutDto } from './dto/reject-payout.dto';
import { PayoutsService } from './payouts.service';

@Controller('admin/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get('summary')
  summary() {
    return this.payoutsService.adminSummary();
  }

  @Get()
  list(@Query() query: AdminPayoutQueryDto) {
    return this.payoutsService.adminList(query);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.payoutsService.adminGetById(id);
  }

  @Patch(':id/approve')
  approve(@CurrentUser() admin: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.payoutsService.approve(admin, id);
  }

  @Patch(':id/reject')
  reject(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPayoutDto,
  ) {
    return this.payoutsService.reject(admin, id, dto);
  }

  @Patch(':id/mark-paid')
  markPaid(@CurrentUser() admin: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.payoutsService.markPaid(admin, id);
  }
}
