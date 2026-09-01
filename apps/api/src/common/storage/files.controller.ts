import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/jwt-auth.guard';

import { StorageService } from './storage.service';

import type { Response } from 'express';

@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get('*key')
  @UseGuards(JwtAuthGuard)
  async download(@Param('key') key: string | string[], @Res() res: Response) {
    const raw = Array.isArray(key) ? key.join('/') : key;
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('private/')) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message_en: 'File not found.',
        message_ar: 'الملف غير موجود.',
      });
    }

    const { buffer, mimeType } = await this.storage.read(decoded);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(buffer);
  }
}
