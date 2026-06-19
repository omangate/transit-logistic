import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { ShipmentCommerceService } from './shipment-commerce.service';

@Controller('shipments/:shipmentId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShipmentCommerceController {
  constructor(private readonly commerce: ShipmentCommerceService) {}

  @Get('contract')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  getContract(
    @CurrentUser() user: User,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
  ) {
    return this.commerce.getContract(user.id, user.role, shipmentId).catch(() => {
      throw new BadRequestException({
        code: 'CONTRACT_NOT_FOUND',
        message_en: 'Contract is not available for this shipment yet.',
        message_ar: 'العقد غير متاح لهذه الشحنة بعد.',
      });
    });
  }

  @Get('contract/pdf')
  @Header('Content-Type', 'application/pdf')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  async getContractPdf(
    @CurrentUser() user: User,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
  ) {
    const buffer = await this.commerce.getContractPdf(user.id, user.role, shipmentId).catch(() => {
      throw new BadRequestException({
        code: 'CONTRACT_NOT_FOUND',
        message_en: 'Contract is not available for this shipment yet.',
        message_ar: 'العقد غير متاح لهذه الشحنة بعد.',
      });
    });

    return new StreamableFile(buffer, {
      disposition: `attachment; filename="contract-${shipmentId}.pdf"`,
    });
  }

  @Get('invoice')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  getInvoice(
    @CurrentUser() user: User,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
  ) {
    return this.commerce.getInvoice(user.id, user.role, shipmentId).catch(() => {
      throw new BadRequestException({
        code: 'INVOICE_NOT_FOUND',
        message_en: 'Invoice is not available for this shipment yet.',
        message_ar: 'الفاتورة غير متاحة لهذه الشحنة بعد.',
      });
    });
  }

  @Get('invoice/pdf')
  @Header('Content-Type', 'application/pdf')
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  async getInvoicePdf(
    @CurrentUser() user: User,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
  ) {
    const buffer = await this.commerce.getInvoicePdf(user.id, user.role, shipmentId).catch(() => {
      throw new BadRequestException({
        code: 'INVOICE_NOT_FOUND',
        message_en: 'Invoice is not available for this shipment yet.',
        message_ar: 'الفاتورة غير متاحة لهذه الشحنة بعد.',
      });
    });

    return new StreamableFile(buffer, {
      disposition: `attachment; filename="invoice-${shipmentId}.pdf"`,
    });
  }
}
