import { Module } from '@nestjs/common';
import { AgentController, ExecutionController } from './agent.controller';
import { AgentService } from './agent.service';
import { LangGraphModule } from '../langgraph/langgraph.module';

@Module({
  imports: [LangGraphModule],
  controllers: [AgentController, ExecutionController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
