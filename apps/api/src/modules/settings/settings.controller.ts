/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@transit-logistic/shared';

import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { UpdateSettingsSectionDto } from './dto/update-settings-section.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('public')
  @Public()
  getPublicSettings() {
    return this.settings.getSection('company').then((company) => ({
      company,
      branding: DEFAULT_PUBLIC_BRANDING,
    }));
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAll() {
    return this.settings.getAll();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Body() dto: UpdateSettingsSectionDto) {
    return this.settings.updateSection(dto.key, dto.value);
  }
}

const DEFAULT_PUBLIC_BRANDING = {
  primaryColor: '#1D4ED8',
  accentColor: '#FDE68A',
  logoUrl: '/logo.svg',
};
