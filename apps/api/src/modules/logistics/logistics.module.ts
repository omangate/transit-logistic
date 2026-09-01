import { Module } from '@nestjs/common';

import { FleetModule } from '../fleet/fleet.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { ChecklistTemplatesService } from './checklist-templates.service';
import { FleetLogisticsController } from './fleet-logistics.controller';
import { FleetLogisticsService } from './fleet-logistics.service';
import { AdminCustomsController, CustomsClearanceController } from './customs-clearance.controller';
import { AdminCustomsDeclarationController } from './customs-declaration-prep.controller';
import { AdminOmanHsTariffController } from './oman-hs-tariff.controller';
import { CustomsClearanceService } from './customs-clearance.service';
import { CustomsDeclarationPrepService } from './customs-declaration-prep.service';
import { CustomsDocumentExtractionService } from './customs-document-extraction.service';
import { OmanHsTariffImportService } from './oman-hs-tariff-import.service';
import { OmanHsTariffService } from './oman-hs-tariff.service';
import { AdminFreightController, FreightForwardingController } from './freight-forwarding.controller';
import { FreightForwardingService } from './freight-forwarding.service';
import {
  AdminChecklistTemplatesController,
  LogisticsChargesController,
  LogisticsContainersController,
  LogisticsReportsController,
  LogisticsVehiclesController,
} from './logistics-admin.controller';
import { LogisticsAccessService } from './logistics-access.service';
import { LogisticsAuditService } from './logistics-audit.service';
import { LogisticsChargesService } from './logistics-charges.service';
import { LogisticsContainersService } from './logistics-containers.service';
import {
  AdminLogisticsDocumentsController,
  LogisticsConversationsController,
  LogisticsDocumentsController,
  LogisticsQuotesController,
} from './logistics-support.controller';
import { LogisticsConversationsService } from './logistics-conversations.service';
import { LogisticsDocumentsService } from './logistics-documents.service';
import { LogisticsOrdersController, AdminLogisticsOpsController } from './logistics-orders.controller';
import { LogisticsOrdersService } from './logistics-orders.service';
import { LogisticsPdfService } from './logistics-pdf.service';
import { LogisticsQuotesService } from './logistics-quotes.service';
import { LogisticsVehiclesService } from './logistics-vehicles.service';

@Module({
  imports: [NotificationsModule, FleetModule],
  controllers: [
    LogisticsOrdersController,
    FleetLogisticsController,
    AdminLogisticsOpsController,
    CustomsClearanceController,
    AdminCustomsController,
    AdminCustomsDeclarationController,
    AdminOmanHsTariffController,
    FreightForwardingController,
    AdminFreightController,
    LogisticsDocumentsController,
    AdminLogisticsDocumentsController,
    LogisticsQuotesController,
    LogisticsConversationsController,
    AdminChecklistTemplatesController,
    LogisticsContainersController,
    LogisticsVehiclesController,
    LogisticsChargesController,
    LogisticsReportsController,
  ],
  providers: [
    LogisticsAccessService,
    LogisticsAuditService,
    LogisticsOrdersService,
    CustomsClearanceService,
    CustomsDeclarationPrepService,
    CustomsDocumentExtractionService,
    OmanHsTariffService,
    OmanHsTariffImportService,
    FreightForwardingService,
    LogisticsDocumentsService,
    LogisticsQuotesService,
    LogisticsConversationsService,
    FleetLogisticsService,
    ChecklistTemplatesService,
    LogisticsContainersService,
    LogisticsVehiclesService,
    LogisticsChargesService,
    LogisticsPdfService,
  ],
  exports: [
    LogisticsOrdersService,
    CustomsClearanceService,
    FreightForwardingService,
    LogisticsDocumentsService,
    LogisticsQuotesService,
    LogisticsContainersService,
    LogisticsVehiclesService,
    LogisticsChargesService,
  ],
})
export class LogisticsModule {}
