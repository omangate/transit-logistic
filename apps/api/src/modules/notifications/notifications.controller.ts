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

import { MarkNotificationsReadDto } from './dto/mark-notifications-read.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.CUSTOMER,
  UserRole.FLEET_OWNER,
  UserRole.DRIVER,
  UserRole.ADMIN,
)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: NotificationQueryDto) {
    return this.notificationsService.list(user, query);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: User) {
    return this.notificationsService.getUnreadCount(user);
  }

  @Get(':id')
  getById(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.getById(user, id);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markAsRead(user, id);
  }

  @Post('read')
  markManyAsRead(@CurrentUser() user: User, @Body() dto: MarkNotificationsReadDto) {
    return this.notificationsService.markManyAsRead(user, dto.notificationIds);
  }

  @Post('read-all')
  markAllAsRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllAsRead(user);
  }
}
