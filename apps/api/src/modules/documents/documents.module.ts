import { Module } from '@nestjs/common';

import { ShipmentsModule } from '../shipments/shipments.module';

import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [ShipmentsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
