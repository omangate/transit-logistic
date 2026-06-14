import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { WalletsModule } from '../wallets/wallets.module';

import { AdminPricingController } from './admin-pricing.controller';
import { PricingEngineService } from './pricing-engine.service';
import { PricingRulesService } from './pricing-rules.service';
import { PricingController } from './pricing.controller';

@Module({
  imports: [AuthModule, WalletsModule],
  controllers: [PricingController, AdminPricingController],
  providers: [PricingEngineService, PricingRulesService],
  exports: [PricingEngineService, PricingRulesService],
})
export class PricingModule {}
