import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { OmanHsTariffImportService } from './oman-hs-tariff-import.service';
import { OmanHsTariffService } from './oman-hs-tariff.service';

type MulterFile = { buffer: Buffer; mimetype: string; size: number; originalname?: string };

@Controller('admin/customs/hs-tariff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminOmanHsTariffController {
  constructor(
    private readonly hsTariff: OmanHsTariffService,
    private readonly importService: OmanHsTariffImportService,
  ) {}

  @Get('stats')
  stats() {
    return this.importService.getDatasetStats();
  }

  @Get('batches')
  batches() {
    return this.importService.listBatches();
  }

  @Get('search')
  search(@Query('q') q: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.hsTariff.search(q ?? '', limit ? Number(limit) : 20, page ? Number(page) : 1);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importFile(
    @CurrentUser() user: User,
    @UploadedFile() file: MulterFile,
    @Body() body: { tariffVersion?: string; tariffYear?: string; archivePrevious?: string; notes?: string },
  ) {
    const records = this.importService.parseFile(file.buffer, file.originalname ?? 'import.json');
    return this.importService.importRecords(user, records, {
      fileName: file.originalname,
      fileFormat: (file.originalname ?? '').split('.').pop() ?? 'unknown',
      tariffVersion: body.tariffVersion ?? 'GCC-2025',
      tariffYear: body.tariffYear ? Number(body.tariffYear) : 2025,
      archivePrevious: body.archivePrevious === 'true',
      notes: body.notes,
    });
  }
}
