/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@transit-logistic/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { AdminCustomersService } from './admin-customers.service';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  listCustomers() {
    return this.customers.listCustomers();
  }
}
