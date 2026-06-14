/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentHistoryQueryDto } from './dto/payment-history-query.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('shipments/:shipmentId/payment-quote')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  getShipmentPaymentQuote(
    @CurrentUser() user: User,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
  ) {
    return this.payments.getShipmentPaymentQuote(user, shipmentId);
  }

  @Post('shipments/:shipmentId/payment-intent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  createShipmentPaymentIntent(
    @CurrentUser() user: User,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.payments.createShipmentPaymentIntent(user, shipmentId, dto ?? {});
  }

  @Post('shipments/:shipmentId/payment/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  verifyShipmentPayment(
    @CurrentUser() user: User,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
  ) {
    return this.payments.verifyShipmentPayment(user, shipmentId);
  }

  @Post('payments/intents/:paymentIntentId/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  confirmPaymentIntent(
    @CurrentUser() user: User,
    @Param('paymentIntentId', ParseUUIDPipe) paymentIntentId: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.payments.confirmPaymentIntent(user, paymentIntentId, dto);
  }

  @Get('payments/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  listPaymentHistory(@CurrentUser() user: User, @Query() query: PaymentHistoryQueryDto) {
    return this.payments.listPaymentHistory(user, query);
  }

  @Post('payments/webhooks/:provider')
  @Public()
  handleWebhook(
    @Param('provider') provider: string,
    @Body() dto: PaymentWebhookDto,
    @Headers('x-thawani-signature') thawaniSignature: string | undefined,
    @Headers('stripe-signature') stripeSignature: string | undefined,
    @Req() req: Request,
  ) {
    return this.payments.handleWebhook(provider, dto, {
      rawBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
      signature: thawaniSignature ?? stripeSignature,
    });
  }
}
