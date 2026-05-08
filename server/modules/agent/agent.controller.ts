import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { NeedLogin, CanRole } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { AgentService } from './agent.service';
import { AgentGraphService } from '../langgraph/agent-graph.service';
import { TaskExecutionService, type SubTaskRecord } from '../langgraph/task-execution.service';
import type {
  AgentConfig,
  AgentListResp,
  CreateAgentRequest,
  UpdateAgentRequest,
  ExecuteAgentRequest,
  ExecuteAgentResponse,
  TaskExecutionListResp,
  TaskExecutionRecord,
} from '@shared/api.interface';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWithAgentRequest {
  messages: ChatMessage[];
  mentions?: Array<{ type: 'knowledge' | 'tool'; id: string; name: string }>;
}

@Controller('api/agents')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly agentGraphService: AgentGraphService,
    private readonly taskExecutionService: TaskExecutionService,
  ) {}

  @Get()
  async getAgents(): Promise<AgentListResp> {
    return this.agentService.getAgents();
  }

  @Get(':id')
  async getAgentById(@Param('id') id: string): Promise<AgentConfig | null> {
    return this.agentService.getAgentById(id);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Post()
  async createAgent(
    @Req() req: Request,
    @Body() dto: CreateAgentRequest,
  ): Promise<AgentConfig> {
    const { userId } = req.userContext;
    return this.agentService.createAgent(userId, dto);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Put(':id')
  async updateAgent(
    @Param('id') id: string,
    @Body() dto: UpdateAgentRequest,
  ): Promise<AgentConfig | null> {
    return this.agentService.updateAgent(id, dto);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Delete(':id')
  async deleteAgent(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.agentService.deleteAgent(id);
    return { success };
  }

  @NeedLogin()
  @Post(':id/chat')
  async chatWithAgent(
    @Param('id') id: string,
    @Body() dto: ChatWithAgentRequest,
    @Req() req: Request,
  ) {
    const userId = req.userContext?.userId;
    if (!userId) {
      throw new BadRequestException('用户未登录');
    }

    this.logger.log(`Agent 对话请求: ${id}, 用户: ${userId}`);

    const agent = await this.agentService.getAgentById(id);
    if (!agent) {
      throw new NotFoundException('Agent 不存在');
    }

    if (!agent.isActive) {
      throw new BadRequestException('Agent 已禁用');
    }

    const result = await this.agentGraphService.chat(userId, agent, dto.messages, dto.mentions);

    return {
      content: result.content,
      toolCalls: result.toolCalls,
    };
  }

  @NeedLogin()
  @Post(':id/execute')
  async executeAgent(
    @Param('id') id: string,
    @Body() dto: ExecuteAgentRequest,
    @Req() req: Request,
  ): Promise<ExecuteAgentResponse> {
    const userId = req.userContext?.userId;
    if (!userId) {
      throw new Error('用户未登录');
    }

    const agent = await this.agentService.getAgentById(id);
    if (!agent) {
      throw new NotFoundException('Agent 不存在');
    }

    if (!agent.isActive) {
      throw new Error('Agent 已禁用');
    }

    // 创建纯净的agent对象，避免循环引用
    const cleanAgent: AgentConfig = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      instruction: agent.instruction,
      greeting: agent.greeting,
      model: agent.model,
      knowledgeBase: agent.knowledgeBase,
      tools: agent.tools,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };

    // 创建任务执行记录
    const executionId = await this.taskExecutionService.createExecution(
      id,
      userId,
      dto.query,
      { tasks: [] },
    );

    // 异步执行任务，不等待完成
    this.runExecutionAsync(executionId, userId, cleanAgent, dto.query);

    // 立即返回任务ID，前端通过轮询查询状态
    return {
      executionId,
      plan: { tasks: [] },
      finalResponse: '',
      status: 'running',
    };
  }

  /**
   * 异步执行Agent任务
   */
  private async runExecutionAsync(
    executionId: string,
    userId: string,
    agent: AgentConfig,
    query: string,
  ): Promise<void> {
    try {
      this.logger.log(`开始异步执行任务: ${executionId}`);

      // 执行带任务拆解的对话
      const executionResult = await this.agentGraphService.executeWithPlanning(
        userId,
        agent,
        query,
      );

      // 清理数据，确保可序列化
      const cleanPlan = executionResult.plan ? JSON.parse(JSON.stringify(executionResult.plan)) : undefined;
      const cleanFinalResponse = executionResult.finalResponse;
      const cleanTokenUsage = executionResult.tokenUsage;

      // 更新执行记录
      if (cleanPlan) {
        await this.taskExecutionService.updatePlan(executionId, cleanPlan);
      }
      await this.taskExecutionService.completeExecution(
        executionId,
        cleanFinalResponse,
        cleanTokenUsage,
      );

      this.logger.log(`异步任务完成: ${executionId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '执行失败';
      this.logger.error(`异步任务失败: ${executionId} - ${errorMessage}`);

      await this.taskExecutionService.failExecution(
        executionId,
        `执行失败: ${errorMessage}`,
      );
    }
  }

  @NeedLogin()
  @Get(':id/executions')
  async getAgentExecutions(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<TaskExecutionListResp> {
    const agent = await this.agentService.getAgentById(id);
    if (!agent) {
      throw new NotFoundException('Agent 不存在');
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    return this.taskExecutionService.getExecutionHistory(id, parsedLimit, parsedOffset);
  }
}

@Controller('api/executions')
export class ExecutionController {
  private readonly logger = new Logger(ExecutionController.name);

  constructor(private readonly taskExecutionService: TaskExecutionService) {}

  @Get(':executionId')
  async getExecutionDetail(
    @Param('executionId') executionId: string,
  ): Promise<TaskExecutionRecord | null> {
    return this.taskExecutionService.getExecution(executionId);
  }

  @Get(':executionId/subtasks')
  async getExecutionSubTasks(
    @Param('executionId') executionId: string,
  ): Promise<SubTaskRecord[]> {
    return this.taskExecutionService.getSubTasks(executionId);
  }
}
