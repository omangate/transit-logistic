import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { LogisticsOrdersService } from './logistics-orders.service';

@Controller('logistics/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsOrdersController {
  constructor(private readonly orders: LogisticsOrdersService) {}

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  list(@CurrentUser() user: User) {
    return this.orders.listForUser(user);
  }

  @Get('dashboard')
  @Roles(UserRole.CUSTOMER)
  dashboard(@CurrentUser() user: User) {
    return this.orders.getCustomerDashboard(user);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getById(user, id);
  }

  @Get(':id/timeline')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  timeline(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getMasterTimeline(user, id);
  }

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  create(@CurrentUser() user: User, @Body() body: { title?: string; description?: string }) {
    return this.orders.create(user, body);
  }
}

@Controller('admin/logistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminLogisticsOpsController {
  constructor(private readonly orders: LogisticsOrdersService) {}

  @Get('dashboard')
  opsDashboard(@CurrentUser() user: User) {
    return this.orders.getAdminOpsDashboard(user);
  }
}
