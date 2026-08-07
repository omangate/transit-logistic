import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { FreightForwardingService } from './freight-forwarding.service';

@Controller('freight')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FreightForwardingController {
  constructor(private readonly freight: FreightForwardingService) {}

  @Get('shipments')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  list(@CurrentUser() user: User) {
    return this.freight.listForUser(user);
  }

  @Get('shipments/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.freight.getById(user, id);
  }

  @Post('requests')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  create(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.freight.createDraft(user, body as never);
  }

  @Patch('shipments/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.freight.update(user, id, body);
  }

  @Post('shipments/:id/submit')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  submit(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.freight.submit(user, id);
  }
}

@Controller('admin/freight')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminFreightController {
  constructor(private readonly freight: FreightForwardingService) {}

  @Patch('shipments/:id/status')
  updateStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.freight.updateStatus(user, id, body.status, body.note);
  }
}
