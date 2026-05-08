import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ViewModule } from './modules/view/view.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { TokenMonitorModule } from './modules/token-monitor/token-monitor.module';
import { ConfigModule } from './modules/config/config.module';
import { ChatModule } from './modules/chat/chat.module';
import { AgentModule } from './modules/agent/agent.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { ToolModule } from './modules/tool/tool.module';
import { RoleModule } from './modules/role/role.module';
import { LangGraphModule } from './modules/langgraph/langgraph.module';
import { FileModule } from './modules/file/file.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { DataSourceModule } from './modules/data-source/data-source.module';

@Module({
  imports: [
    // 平台 Module，提供平台能力
    PlatformModule.forRoot(),
// ====== @route-section: business-modules START ======
    // Place all business modules here.Do NOT add fallback modules here.
    ConversationModule,
    ConfigModule,
    ChatModule,
    TokenMonitorModule,
    AgentModule,
    LangGraphModule,
    WorkflowModule,
    KnowledgeModule,
    ToolModule,
    RoleModule,
    OrganizationModule,
    DataSourceModule,
    // ====== @route-section: business-modules END ======
    FileModule,

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
