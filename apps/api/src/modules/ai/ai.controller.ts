import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { User } from '@/types/user';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { AiChatService } from './ai-chat.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiChatService) {}

  @Get('sessions')
  listSessions(@CurrentUser() user: User) {
    return this.ai.listSessions(user);
  }

  @Get('sessions/:id/messages')
  getMessages(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.ai.getMessages(user, id);
  }

  @Post('chat')
  chat(
    @CurrentUser() user: User,
    @Body() body: { message: string; sessionId?: string; locale?: 'en' | 'ar' },
  ) {
    return this.ai.chat(user, body);
  }
}
