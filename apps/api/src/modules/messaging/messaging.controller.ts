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

import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/messaging.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.ADMIN)
  list(@CurrentUser() user: User) {
    return this.messaging.listConversations(user);
  }

  @Get(':id/messages')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.ADMIN)
  listMessages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
  ) {
    return this.messaging.listMessages(user, id, page ? Number(page) : 1);
  }

  @Post(':id/messages')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.ADMIN)
  send(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messaging.sendMessage(user, id, dto.body);
  }

  @Post('open')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER)
  open(@CurrentUser() user: User, @Body() dto: SendMessageDto & { quoteId?: string; bookingId?: string; shipmentId?: string }) {
    return this.messaging.openConversation(user, dto);
  }
}
