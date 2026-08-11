import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { User } from '@/types/user';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { UpdateEmailDto, UpdateEmailPreferencesDto } from '../auth/dto/email-verification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailPreferencesService } from '../email/email-preferences.service';

import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailPreferences: EmailPreferencesService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: User) {
    return this.usersService.getMe(user.id);
  }

  @Get('me/email-preferences')
  @UseGuards(JwtAuthGuard)
  getEmailPreferences(@CurrentUser() user: User) {
    return this.emailPreferences.getForUser(user.id);
  }

  @Patch('me/email-preferences')
  @UseGuards(JwtAuthGuard)
  updateEmailPreferences(@CurrentUser() user: User, @Body() dto: UpdateEmailPreferencesDto) {
    return this.emailPreferences.updateForUser(user.id, dto);
  }

  @Patch('me/email')
  @UseGuards(JwtAuthGuard)
  updateEmail(@CurrentUser() user: User, @Body() dto: UpdateEmailDto) {
    return this.authService.updateEmail(user.id, dto.email);
  }
}
