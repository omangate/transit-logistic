import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { WalletLedgerService } from './wallet-ledger.service';
import { WalletsAdminController } from './wallets-admin.controller';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [WalletsController, WalletsAdminController],
  providers: [WalletsService, WalletLedgerService],
  exports: [WalletsService, WalletLedgerService],
})
export class WalletsModule {}
