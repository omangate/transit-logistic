import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { FleetDocumentsService } from './fleet-documents.service';

type MulterFile = { buffer: Buffer; mimetype: string; size: number; originalname?: string };

@Controller('fleet/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FLEET_OWNER, UserRole.ADMIN)
export class FleetDocumentsController {
  constructor(private readonly documents: FleetDocumentsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.documents.listForFleet(user);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: User,
    @UploadedFile() file: MulterFile,
    @Body('documentType') documentType: string,
    @Body('expiresAt') expiresAt?: string,
  ) {
    return this.documents.upload(user, file, documentType, expiresAt);
  }

  @Get(':id/download')
  async download(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const file = await this.documents.download(user, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.send(file.buffer);
  }
}

@Controller('admin/fleet/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminFleetDocumentsController {
  constructor(private readonly documents: FleetDocumentsService) {}

  @Get()
  listPending() {
    return this.documents.listPendingForAdmin();
  }

  @Patch(':id/review')
  review(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: 'approved' | 'rejected' | 'expired'; reviewNote?: string },
  ) {
    return this.documents.reviewDocument(user, id, body.status, body.reviewNote);
  }
}
