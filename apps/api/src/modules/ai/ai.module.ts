import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';

import { AiController } from './ai.controller';
import { AiChatService } from './ai-chat.service';
import { MockAiProvider, OpenAiProvider } from './ai-providers.service';
import { AiToolsService } from './ai-tools.service';

@Module({
  imports: [AuthModule, MarketplaceModule, AdminModule],
  controllers: [AiController],
  providers: [AiChatService, AiToolsService, MockAiProvider, OpenAiProvider],
  exports: [AiChatService],
})
export class AiModule {}
