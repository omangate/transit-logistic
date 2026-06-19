import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { DocumentsService } from './documents.service';

type UploadedFile = {
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('shipments/:shipmentId/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  list(
    @CurrentUser() user: User,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
  ) {
    return this.documents.listShipmentDocuments(user, shipmentId);
  }

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.FLEET_OWNER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: User,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @UploadedFile() file: UploadedFile,
    @Body('documentType') documentType?: string,
  ) {
    const type = documentType?.trim() || 'customs';
    return this.documents.uploadShipmentDocument(user, shipmentId, type, file);
  }
}
