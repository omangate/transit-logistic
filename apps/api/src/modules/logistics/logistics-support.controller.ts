import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { LogisticsConversationsService } from './logistics-conversations.service';
import { LogisticsDocumentsService } from './logistics-documents.service';
import { LogisticsQuotesService } from './logistics-quotes.service';

type MulterFile = { buffer: Buffer; mimetype: string; size: number; originalname?: string };

@Controller('logistics/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsDocumentsController {
  constructor(private readonly documents: LogisticsDocumentsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: User,
    @UploadedFile() file: MulterFile,
    @Body('category') category: string,
    @Body('logisticsOrderId') logisticsOrderId?: string,
    @Body('customsRequestId') customsRequestId?: string,
    @Body('freightRequestId') freightRequestId?: string,
    @Body('documentNumber') documentNumber?: string,
    @Body('issueDate') issueDate?: string,
    @Body('expiresAt') expiresAt?: string,
  ) {
    return this.documents.upload(user, file, {
      category: category as never,
      logisticsOrderId,
      customsRequestId,
      freightRequestId,
      documentNumber,
      issueDate,
      expiresAt,
    });
  }

  @Get(':id/download')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async download(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.documents.download(user, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get('missing/list')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  listMissing(
    @CurrentUser() user: User,
    @Query('customsRequestId') customsRequestId?: string,
    @Query('freightRequestId') freightRequestId?: string,
  ) {
    return this.documents.listMissing(user, customsRequestId, freightRequestId);
  }
}

@Controller('admin/logistics/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminLogisticsDocumentsController {
  constructor(private readonly documents: LogisticsDocumentsService) {}

  @Patch(':id/review')
  review(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: 'approved' | 'rejected' | 'expired'; reviewNote?: string },
  ) {
    return this.documents.review(user, id, body.status, body.reviewNote);
  }

  @Patch('checklist-items/:itemId/mark-missing')
  markChecklistMissing(
    @CurrentUser() user: User,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: { dueDate?: string; note?: string },
  ) {
    return this.documents.markChecklistItemMissing(user, itemId, body);
  }
}

@Controller('logistics/quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsQuotesController {
  constructor(private readonly quotes: LogisticsQuotesService) {}

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  list(
    @CurrentUser() user: User,
    @Query('customsRequestId') customsRequestId?: string,
    @Query('freightRequestId') freightRequestId?: string,
    @Query('logisticsOrderId') logisticsOrderId?: string,
  ) {
    return this.quotes.listForContext(user, { customsRequestId, freightRequestId, logisticsOrderId });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.quotes.createQuote(user, body as never);
  }

  @Post(':id/amend')
  @Roles(UserRole.ADMIN)
  amend(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.quotes.amendQuote(user, id, body as never);
  }

  @Post(':id/respond')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  respond(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { action: 'accept' | 'reject' | 'counter' | 'amend'; customerNote?: string },
  ) {
    return this.quotes.respond(user, id, body.action, body.customerNote);
  }
}

@Controller('logistics/conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsConversationsController {
  constructor(private readonly conversations: LogisticsConversationsService) {}

  @Post('open')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  open(@CurrentUser() user: User, @Body() body: Record<string, string>) {
    return this.conversations.getOrCreate(user, body);
  }

  @Get(':id/messages')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  messages(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.listMessages(user, id);
  }

  @Post(':id/messages')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  send(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('body') body: string,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.conversations.sendMessage(user, id, body ?? '', file);
  }

  @Get('messages/:messageId/attachment')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async downloadAttachment(
    @CurrentUser() user: User,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Res() res: Response,
  ) {
    const file = await this.conversations.downloadAttachment(user, messageId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.send(file.buffer);
  }
}
