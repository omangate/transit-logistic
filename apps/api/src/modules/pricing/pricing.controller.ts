/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { WalletLedgerService } from '../wallets/wallet-ledger.service';

import { EstimatePricingDto } from './dto/estimate-pricing.dto';
import { PricingEngineService } from './pricing-engine.service';

@Controller('pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.ADMIN)
export class PricingController {
  constructor(
    private readonly pricingEngine: PricingEngineService,
    private readonly walletLedger: WalletLedgerService,
  ) {}

  @Post('estimate')
  async estimate(@Body() dto: EstimatePricingDto) {
    const result = await this.pricingEngine.estimate(dto);

    return {
      pricingRuleId: result.pricingRuleId,
      baseAmount: result.baseAmount.toFixed(2),
      platformFee: result.platformFee.toFixed(2),
      totalAmount: result.totalAmount.toFixed(2),
      breakdown: result.breakdown,
    };
  }

  @Post('wallet-estimate')
  async walletEstimate(
    @CurrentUser() user: User,
    @Body() dto: EstimatePricingDto,
  ) {
    const result = await this.pricingEngine.estimate(dto);
    const wallet = await this.walletLedger.getOrCreateWallet(user.id);
    const balance = wallet.balance;
    const sufficient = balance.greaterThanOrEqualTo(result.totalAmount);
    const shortfall = sufficient
      ? '0.00'
      : result.totalAmount.minus(balance).toFixed(2);

    return {
      pricingRuleId: result.pricingRuleId,
      baseAmount: result.baseAmount.toFixed(2),
      platformFee: result.platformFee.toFixed(2),
      totalAmount: result.totalAmount.toFixed(2),
      breakdown: result.breakdown,
      wallet: {
        balance: balance.toFixed(2),
        sufficient,
        shortfall,
        chargeAmount: result.totalAmount.toFixed(2),
      },
    };
  }
}
