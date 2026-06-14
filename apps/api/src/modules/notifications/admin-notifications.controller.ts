/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@transit-logistic/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { NotificationDeliveryService } from './notification-delivery.service';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminNotificationsController {
  constructor(private readonly delivery: NotificationDeliveryService) {}

  @Post('broadcast')
  broadcast(@Body() dto: BroadcastNotificationDto) {
    return this.delivery.broadcast(dto);
  }
}
