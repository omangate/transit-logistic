import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { TruckMediaService } from './truck-media.service';

type MulterFile = { buffer: Buffer; mimetype: string; size: number; originalname?: string };

@Controller('fleet/marketplace/trucks/:listingId/media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FLEET_OWNER, UserRole.ADMIN)
export class TruckMediaController {
  constructor(private readonly media: TruckMediaService) {}

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 10))
  uploadImages(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @UploadedFiles() files: MulterFile[],
  ) {
    return this.media.uploadImages(user, listingId, files ?? []);
  }

  @Post('video')
  @UseInterceptors(FileInterceptor('file'))
  uploadVideo(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @UploadedFile() file: MulterFile,
  ) {
    return this.media.uploadVideo(user, listingId, file);
  }

  @Delete('images/:imageId')
  deleteImage(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.media.deleteImage(user, listingId, imageId);
  }

  @Patch('images/reorder')
  reorder(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() body: { imageIds: string[] },
  ) {
    return this.media.reorderImages(user, listingId, body.imageIds ?? []);
  }

  @Post('images/:imageId/cover')
  setCover(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.media.setCover(user, listingId, imageId);
  }

  @Patch('draft')
  saveDraft(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.media.saveDraft(user, listingId, body);
  }
}
