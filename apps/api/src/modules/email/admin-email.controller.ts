import { UserRole } from '@transit-logistic/shared';
import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { EmailDeliveryStatus } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EmailDeliveryLogService } from './email-delivery-log.service';
import { TransactionalEmailService } from './transactional-email.service';

@Controller('admin/email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminEmailController {
  constructor(
    private readonly deliveryLogs: EmailDeliveryLogService,
    private readonly transactionalEmail: TransactionalEmailService,
  ) {}

  @Get('provider-status')
  providerStatus() {
    return this.transactionalEmail.getProviderStatus();
  }

  @Get('delivery-logs')
  listDeliveryLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: EmailDeliveryStatus,
    @Query('recipientEmail') recipientEmail?: string,
    @Query('templateEvent') templateEvent?: string,
  ) {
    return this.deliveryLogs.listForAdmin({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      recipientEmail,
      templateEvent,
    });
  }

  @Post('send-test')
  sendTestEmail() {
    return this.transactionalEmail.sendAdminStagingTest();
  }
}
