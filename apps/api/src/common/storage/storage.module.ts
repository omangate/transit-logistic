import { Global, Module } from '@nestjs/common';

import { ImageProcessorService } from './image-processor.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService, ImageProcessorService],
  exports: [StorageService, ImageProcessorService],
})
export class StorageModule {}
