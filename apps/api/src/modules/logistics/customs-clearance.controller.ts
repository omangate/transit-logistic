import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { CustomsClearanceService } from './customs-clearance.service';

@Controller('customs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomsClearanceController {
  constructor(private readonly customs: CustomsClearanceService) {}

  @Get('requests')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  list(@CurrentUser() user: User) {
    return this.customs.listForUser(user);
  }

  @Get('requests/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.customs.getById(user, id);
  }

  @Post('requests')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  create(@CurrentUser() user: User, @Body() body: { logisticsOrderId?: string; transactionType: string }) {
    return this.customs.createDraft(user, body as never);
  }

  @Patch('requests/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.customs.update(user, id, body);
  }

  @Post('requests/:id/submit')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  submit(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.customs.submit(user, id);
  }
}

@Controller('admin/customs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCustomsController {
  constructor(private readonly customs: CustomsClearanceService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: User) {
    return this.customs.opsDashboard(user);
  }

  @Get('search')
  search(@CurrentUser() user: User, @Query('q') q: string) {
    return this.customs.search(user, q ?? '');
  }

  @Patch('requests/:id/status')
  updateStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.customs.updateStatus(user, id, body.status, body.note);
  }
}
