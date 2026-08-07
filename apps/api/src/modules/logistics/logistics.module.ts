import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { AdminCustomsController, CustomsClearanceController } from './customs-clearance.controller';
import { CustomsClearanceService } from './customs-clearance.service';
import { AdminFreightController, FreightForwardingController } from './freight-forwarding.controller';
import { FreightForwardingService } from './freight-forwarding.service';
import { LogisticsAccessService } from './logistics-access.service';
import { LogisticsAuditService } from './logistics-audit.service';
import {
  AdminLogisticsDocumentsController,
  LogisticsConversationsController,
  LogisticsDocumentsController,
  LogisticsQuotesController,
} from './logistics-support.controller';
import { LogisticsConversationsService } from './logistics-conversations.service';
import { LogisticsDocumentsService } from './logistics-documents.service';
import { LogisticsOrdersController } from './logistics-orders.controller';
import { LogisticsOrdersService } from './logistics-orders.service';
import { LogisticsQuotesService } from './logistics-quotes.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    LogisticsOrdersController,
    CustomsClearanceController,
    AdminCustomsController,
    FreightForwardingController,
    AdminFreightController,
    LogisticsDocumentsController,
    AdminLogisticsDocumentsController,
    LogisticsQuotesController,
    LogisticsConversationsController,
  ],
  providers: [
    LogisticsAccessService,
    LogisticsAuditService,
    LogisticsOrdersService,
    CustomsClearanceService,
    FreightForwardingService,
    LogisticsDocumentsService,
    LogisticsQuotesService,
    LogisticsConversationsService,
  ],
  exports: [
    LogisticsOrdersService,
    CustomsClearanceService,
    FreightForwardingService,
    LogisticsDocumentsService,
    LogisticsQuotesService,
  ],
})
export class LogisticsModule {}
