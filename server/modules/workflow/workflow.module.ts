import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowExecutionService } from './workflow-execution.service';

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowExecutionService],
  exports: [WorkflowService, WorkflowExecutionService],
})
export class WorkflowModule {}
