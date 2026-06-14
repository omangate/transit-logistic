import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FleetModule } from '../fleet/fleet.module';
import { WalletsModule } from '../wallets/wallets.module';

import { AdminPayoutsController } from './admin-payouts.controller';
import { PayoutStateService } from './payout-state.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [AuthModule, FleetModule, WalletsModule],
  controllers: [PayoutsController, AdminPayoutsController],
  providers: [PayoutsService, PayoutStateService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
