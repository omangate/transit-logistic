/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@transit-logistic/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { AdminWalletOperationDto } from './dto/admin-wallet-operation.dto';
import { WalletsService } from './wallets.service';

@Controller('wallets/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class WalletsAdminController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post('credit')
  credit(@Body() dto: AdminWalletOperationDto) {
    return this.walletsService.adminCredit(dto);
  }

  @Post('debit')
  debit(@Body() dto: AdminWalletOperationDto) {
    return this.walletsService.adminDebit(dto);
  }
}
