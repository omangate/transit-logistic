import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import {
  AddTicketMessageDto,
  CreateSupportTicketDto,
  UpdateTicketStatusDto,
} from './dto/support.dto';
import { SupportService } from './support.service';

@Controller('support/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER)
  create(@CurrentUser() user: User, @Body() dto: CreateSupportTicketDto) {
    return this.support.create(user, dto);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  list(@CurrentUser() user: User) {
    return this.support.listForUser(user);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  getOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.getById(user, id);
  }

  @Post(':id/messages')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  addMessage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTicketMessageDto,
  ) {
    return this.support.addMessage(user, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  updateStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.support.updateStatus(user, id, dto);
  }
}
