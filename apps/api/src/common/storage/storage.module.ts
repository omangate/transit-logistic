import { Global, Module } from '@nestjs/common';

import { FilesController } from './files.controller';
import { ImageProcessorService } from './image-processor.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [FilesController],
  providers: [StorageService, ImageProcessorService],
  exports: [StorageService, ImageProcessorService],
})
export class StorageModule {}
