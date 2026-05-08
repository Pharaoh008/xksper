import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { NeedLogin, CanRole } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { WorkflowService } from './workflow.service';
import { WorkflowExecutionService } from './workflow-execution.service';
import type {
  WorkflowConfig,
  WorkflowListResp,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  ExecuteWorkflowResp,
  ExecuteWorkflowRequest,
} from '@shared/api.interface';

@Controller('api/workflows')
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly executionService: WorkflowExecutionService,
  ) {}

  @Get()
  async getWorkflows(): Promise<WorkflowListResp> {
    return this.workflowService.getWorkflows();
  }

  @Get(':id')
  async getWorkflowById(@Param('id') id: string): Promise<WorkflowConfig | null> {
    return this.workflowService.getWorkflowById(id);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Post()
  async createWorkflow(
    @Req() req: Request,
    @Body() dto: CreateWorkflowRequest,
  ): Promise<WorkflowConfig> {
    const { userId } = req.userContext;
    return this.workflowService.createWorkflow(userId, dto);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Put(':id')
  async updateWorkflow(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowRequest,
  ): Promise<WorkflowConfig | null> {
    return this.workflowService.updateWorkflow(id, dto);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Delete(':id')
  async deleteWorkflow(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.workflowService.deleteWorkflow(id);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Post(':id/toggle')
  async toggleWorkflow(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ): Promise<WorkflowConfig | null> {
    return this.workflowService.updateWorkflow(id, { isActive: body.isActive });
  }

  @NeedLogin()
  @Post(':id/execute')
  async executeWorkflow(
    @Param('id') id: string,
    @Body() body: ExecuteWorkflowRequest,
  ): Promise<ExecuteWorkflowResp> {
    return this.executionService.executeWorkflow(id, body.inputs);
  }
}
