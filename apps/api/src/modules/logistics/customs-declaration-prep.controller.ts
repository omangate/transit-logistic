import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';
import type { LogisticsDocumentCategory } from '@prisma/client';

import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { CustomsDeclarationPrepService } from './customs-declaration-prep.service';
import { LogisticsDocumentsService } from './logistics-documents.service';
import { OmanHsTariffService } from './oman-hs-tariff.service';

type MulterFile = { buffer: Buffer; mimetype: string; size: number; originalname?: string };

@Controller('admin/customs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCustomsDeclarationController {
  constructor(
    private readonly prep: CustomsDeclarationPrepService,
    private readonly documents: LogisticsDocumentsService,
    private readonly hsTariff: OmanHsTariffService,
  ) {}

  @Get('requests/:id/declaration-draft')
  getDraft(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.prep.getDraft(user, id);
  }

  @Post('requests/:id/extract')
  extractAll(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.prep.extractAll(user, id);
  }

  @Post('requests/:id/build-draft')
  buildDraft(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.prep.buildDraft(user, id);
  }

  @Patch('requests/:id/declaration-draft')
  updateManual(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { customsEntryExitPort?: string; consigneeName?: string; consigneeConfirmed?: boolean; transactionType?: string },
  ) {
    return this.prep.updateManualFields(user, id, body);
  }

  @Patch('declaration-fields/:fieldId')
  updateField(
    @CurrentUser() user: User,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() body: { reviewStatus: 'CONFIRMED_FROM_DOCUMENT' | 'NEEDS_REVIEW' | 'MISSING' | 'MANUALLY_OVERRIDDEN'; displayValue?: string },
  ) {
    return this.prep.updateFieldReview(user, fieldId, body);
  }

  @Post('requests/:id/validate')
  validate(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.prep.validateDraft(user, id);
  }

  @Post('requests/:id/bayan-ready')
  bayanReady(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.prep.markBayanReady(user, id);
  }

  @Get('requests/:id/bayan-view')
  bayanView(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.prep.getBayanView(user, id);
  }

  @Post('requests/:id/documents/upload-and-extract')
  @UseInterceptors(FilesInterceptor('files', 20))
  async uploadAndExtract(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: MulterFile[],
    @Body('categories') categoriesJson?: string,
  ) {
    const categories: string[] = categoriesJson ? JSON.parse(categoriesJson) : files.map(() => 'other');
    return this.prep.uploadAndExtract(
      user,
      id,
      files.map((file, index) => ({
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
        originalname: file.originalname,
        category: categories[index] ?? 'other',
      })),
      async (file, category) =>
        this.documents.upload(user, file, {
          customsRequestId: id,
          category: category as LogisticsDocumentCategory,
        }),
    );
  }

  @Patch('cargo-lines/:lineId/approve-hs')
  approveHs(
    @CurrentUser() user: User,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() body: { hsCode: string },
  ) {
    return this.prep.approveHsCode(user, lineId, body.hsCode);
  }

  @Get('requests/:id/preparation-sheet.pdf')
  async preparationSheet(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { buffer, filename } = await this.prep.getPreparationSheetPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Patch('requests/:id/bayan-record')
  recordBayan(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      bayanDeclarationNumber: string;
      bayanDeclarationDate?: string;
      customsDutyAmount?: number;
      customsPaymentStatus?: string;
      customsReleaseStatus?: string;
      bayanNotes?: string;
    },
  ) {
    return this.prep.recordBayanSubmission(user, id, body);
  }

  @Get('hs-codes/search')
  searchHs(@Query('q') q: string, @Query('page') page?: string) {
    return this.hsTariff.search(q ?? '', 12, page ? Number(page) : 1);
  }

  @Get('consignees/search')
  searchConsignees(@Query('q') q: string) {
    return this.prep.searchConsignees(q ?? '');
  }

  @Post('consignees')
  saveConsignee(
    @CurrentUser() user: User,
    @Body() body: { companyName: string; companyNameAr?: string; crNumber?: string; address?: string; contactPhone?: string; contactEmail?: string },
  ) {
    return this.prep.saveConsignee(user, body);
  }
}
