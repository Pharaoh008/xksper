import { Module } from '@nestjs/common';
import { LangGraphService } from './langgraph.service';
import { AgentGraphService } from './agent-graph.service';
import { TaskExecutionService } from './task-execution.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [LangGraphService, AgentGraphService, TaskExecutionService],
  exports: [LangGraphService, AgentGraphService, TaskExecutionService],
})
export class LangGraphModule {}
