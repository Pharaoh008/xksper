import { Injectable, Logger } from '@nestjs/common';
import { LangGraphService, ChatMessage, ToolCall, ToolResult, ToolDefinition } from './langgraph.service';
import type { AgentConfig } from '@shared/api.interface';

export interface SubTask {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  dependsOn?: string[];
  result?: string;
  toolCalls?: ToolCall[];
  error?: string;
}

export interface TaskPlan {
  tasks: SubTask[];
}

export interface AgentState {
  messages: ChatMessage[];
  knowledgeContext?: string;
  taskPlan?: TaskPlan;
  completedTasks: SubTask[];
  finalResponse?: string;
  tokenUsage: number;
}

export interface ExecutionResult {
  plan: TaskPlan;
  completedTasks: SubTask[];
  finalResponse: string;
  tokenUsage: number;
}

@Injectable()
export class AgentGraphService {
  private readonly logger = new Logger(AgentGraphService.name);

  constructor(private readonly langGraphService: LangGraphService) {}

  /**
   * 与 Agent 对话（简单模式，不进行任务规划）
   */
  async chat(
    userId: string,
    agent: AgentConfig,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    mentions?: Array<{ type: 'knowledge' | 'tool'; id: string; name: string }>,
  ): Promise<{ content: string; toolCalls?: string[] }> {
    this.logger.log(`Agent 对话: ${agent.name}, mentions: ${JSON.stringify(mentions || [])}`);

    const model = agent.model || 'gpt-4o';
    const tools = agent.tools ? await this.langGraphService.getTools(agent.tools) : [];
    const skillContents = agent.tools ? await this.langGraphService.getSkillContents(agent.tools) : [];

    // 转换消息格式
    const chatMessages: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 如果有知识库，先检索上下文
    let knowledgeContext = '';
    if (agent.knowledgeBase && agent.knowledgeBase.length > 0) {
      knowledgeContext = await this.langGraphService.retrieveKnowledge(agent.knowledgeBase);
    }

    // 构建系统提示词
    const systemContent = this.buildChatSystemPrompt(agent, tools, knowledgeContext, skillContents);
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...chatMessages,
    ];

    // 调用 LLM
    const response = await this.langGraphService.callLLM({
      userId,
      model,
      messages: fullMessages,
      tools: tools.length > 0 ? tools : undefined,
    });

    // 处理工具调用
    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolNames = response.toolCalls.map((tc) => tc.function.name);
      return {
        content: response.content,
        toolCalls: toolNames,
      };
    }

    return { content: response.content };
  }

  /**
   * 执行带任务规划的 Agent 对话
   */
  async executeWithPlanning(
    userId: string,
    agent: AgentConfig,
    userQuery: string,
    onProgress?: (type: 'plan' | 'task_start' | 'task_complete' | 'synthesize', data: unknown) => void,
  ): Promise<ExecutionResult> {
    this.logger.log(`开始执行任务规划: ${agent.name}`);
    const startTime = Date.now();
    const MAX_EXECUTION_TIME_MS = 55000; // 55秒上限，接近FaaS极限（通常为60秒）

    const checkTimeout = () => {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        throw new Error('执行超时，请简化请求或稍后重试');
      }
    };

    const state: AgentState = {
      messages: [{ role: 'user', content: userQuery }],
      completedTasks: [],
      tokenUsage: 0,
    };

    // 步骤 1: 检索知识库
    if (agent.knowledgeBase && agent.knowledgeBase.length > 0) {
      this.logger.log(`检索知识库: ${agent.knowledgeBase.join(', ')}`);
      state.knowledgeContext = await this.langGraphService.retrieveKnowledge(agent.knowledgeBase);
      checkTimeout();
    }

    // 步骤 2: Plan 节点 - 生成任务计划
    this.logger.log('开始任务规划');
    state.taskPlan = await this.planNode(userId, agent, userQuery, state.knowledgeContext);
    // 传递可序列化的plan副本
    onProgress?.('plan', JSON.parse(JSON.stringify(state.taskPlan)));
    checkTimeout();

      // 步骤 3: Execute 节点 - 执行子任务
      this.logger.log(`执行任务计划，共 ${state.taskPlan.tasks.length} 个子任务`);
      await this.executeNode(userId, agent, state, onProgress, startTime, MAX_EXECUTION_TIME_MS);

      // 执行后检查超时，如果已超时则直接返回已有结果
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        this.logger.warn('任务执行接近超时，直接返回已有结果');
        const completedResults = state.completedTasks
          .map((t, i) => `${i + 1}. ${t.description}: ${t.result || t.error || '未完成'}`)
          .join('\n');
        // 返回完全可序列化的纯JSON对象
        return JSON.parse(JSON.stringify({
          plan: { tasks: state.taskPlan.tasks },
          completedTasks: state.completedTasks,
          finalResponse: `任务部分完成（已超时）：\n\n${completedResults}`,
          tokenUsage: state.tokenUsage,
        }));
      }

    // 步骤 4: Synthesize 节点 - 整合结果
    this.logger.log('开始整合结果');
    onProgress?.('synthesize', { stage: 'start' });
    state.finalResponse = await this.synthesizeNode(userId, agent, userQuery, state.completedTasks, state.knowledgeContext);
    onProgress?.('synthesize', { stage: 'complete' });

    // 返回完全可序列化的纯JSON对象，使用JSON序列化/反序列化消除所有循环引用
    return JSON.parse(JSON.stringify({
      plan: state.taskPlan,
      completedTasks: state.completedTasks,
      finalResponse: state.finalResponse,
      tokenUsage: state.tokenUsage,
    }));
  }

  /**
   * Plan 节点: 将用户请求拆解为子任务
   */
  private async planNode(
    userId: string,
    agent: AgentConfig,
    userQuery: string,
    knowledgeContext?: string,
  ): Promise<TaskPlan> {
    const model = agent.model || 'gpt-4o';
    const tools = agent.tools ? await this.langGraphService.getTools(agent.tools) : [];

    const systemPrompt = this.buildPlanSystemPrompt(agent, tools, knowledgeContext);

    const planPrompt: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请为以下请求制定任务计划:\n\n${userQuery}` },
    ];

    const response = await this.langGraphService.callLLM({
      userId,
      model,
      messages: planPrompt,
    });

    try {
      const planJson = this.extractJsonFromResponse(response.content);
      const plan: TaskPlan = JSON.parse(planJson);

      // 验证计划格式
      if (!plan.tasks || !Array.isArray(plan.tasks)) {
        throw new Error('任务计划格式错误: 缺少 tasks 数组');
      }

      // 初始化任务状态，只保留可序列化的字段
      plan.tasks = plan.tasks.map((task, index) => ({
        id: task.id || `task-${index + 1}`,
        description: task.description || '',
        status: 'pending' as const,
        dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : [],
      }));

      return plan;
    } catch (error) {
      this.logger.error('解析任务计划失败', error);
      // 如果解析失败，创建一个简单的默认计划
      return {
        tasks: [
          {
            id: 'task-1',
            description: userQuery,
            status: 'pending',
            dependsOn: [],
          },
        ],
      };
    }
  }

  /**
   * Execute 节点: 执行子任务
   */
  private async executeNode(
    userId: string,
    agent: AgentConfig,
    state: AgentState,
    onProgress?: (type: 'plan' | 'task_start' | 'task_complete' | 'synthesize', data: unknown) => void,
    startTime: number = Date.now(),
    maxExecutionTimeMs: number = 50000,
  ): Promise<void> {
    if (!state.taskPlan) return;

    const checkTimeout = () => {
      if (Date.now() - startTime > maxExecutionTimeMs) {
        throw new Error('执行超时，请简化请求或稍后重试');
      }
    };

    const model = agent.model || 'gpt-4o';
    const tools = agent.tools ? await this.langGraphService.getTools(agent.tools) : [];
    const maxConcurrency = 1; // 串行执行更可控
    const maxTasks = 3; // 最多执行3个子任务，避免超时

    const pendingTasks = new Map(state.taskPlan.tasks.slice(0, maxTasks).map((t) => [t.id, t]));
    const completedTaskIds = new Set<string>();

    while (pendingTasks.size > 0) {
      checkTimeout();

      // 找出当前可执行的任务（依赖已满足）
      const executableTasks: SubTask[] = [];
      for (const task of pendingTasks.values()) {
        if (task.status !== 'pending') continue;
        const depsSatisfied = !task.dependsOn || task.dependsOn.every((depId) => completedTaskIds.has(depId));
        if (depsSatisfied) {
          executableTasks.push(task);
        }
      }

      if (executableTasks.length === 0 && pendingTasks.size > 0) {
        // 存在循环依赖或错误
        this.logger.error('任务依赖错误，无法继续执行');
        break;
      }

      // 限制并行数量
      const tasksToRun = executableTasks.slice(0, maxConcurrency);

      // 并行执行任务
      await Promise.all(
        tasksToRun.map(async (task) => {
          onProgress?.('task_start', { taskId: task.id, description: task.description });

          try {
            task.status = 'running';
            const result = await this.executeSubTask(userId, model, task, tools, agent, state, startTime, maxExecutionTimeMs);

            task.status = 'completed';
            task.result = result.content;
            task.toolCalls = result.toolCalls;

            state.completedTasks.push(task);
            completedTaskIds.add(task.id);
            pendingTasks.delete(task.id);

            onProgress?.('task_complete', {
              taskId: task.id,
              description: task.description,
              result: result.content,
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`子任务执行失败: ${task.id}`, errorMsg);
            task.status = 'failed';
            task.error = errorMsg;

            state.completedTasks.push(task);
            completedTaskIds.add(task.id);
            pendingTasks.delete(task.id);

            onProgress?.('task_complete', {
              taskId: task.id,
              description: task.description,
              error: errorMsg,
            });
          }
        }),
      );
    }
  }

  /**
   * 执行单个子任务
   */
  private async executeSubTask(
    userId: string,
    model: string,
    task: SubTask,
    tools: ToolDefinition[],
    agent: AgentConfig,
    state: AgentState,
    startTime: number = Date.now(),
    maxExecutionTimeMs: number = 50000,
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const checkTimeout = () => {
      if (Date.now() - startTime > maxExecutionTimeMs) {
        throw new Error('子任务执行超时');
      }
    };

    const executedTools: ToolCall[] = [];

    // 构建子任务的系统提示词
    const systemContent = this.buildSubTaskSystemPrompt(agent, task, state);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: task.description },
    ];

    // 第一轮 LLM 调用
    let response = await this.langGraphService.callLLM({
      userId,
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
    });
    checkTimeout();

    // 处理工具调用（最多 2 轮，减少避免超时）
    let iterations = 0;
    const maxIterations = 2;

    while (response.toolCalls && response.toolCalls.length > 0 && iterations < maxIterations) {
      iterations++;
      checkTimeout();

      for (const tc of response.toolCalls) {
        executedTools.push(tc);
      }

      // 添加 assistant 的工具调用消息
      messages.push({
        role: 'assistant',
        content: `需要使用工具：${response.toolCalls.map((t) => t.function.name).join(', ')}`,
      });

      // 执行工具
      if (agent.tools) {
        const toolResults = await this.langGraphService.executeTools(response.toolCalls, agent.tools);

        for (const result of toolResults) {
          messages.push({
            role: 'assistant',
            content: `[工具结果: ${result.name}]\n${result.result}`,
          });
        }
      }

      // 再次调用 LLM
      response = await this.langGraphService.callLLM({
        userId,
        model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
      });
    }

    return {
      content: response.content,
      toolCalls: executedTools.length > 0 ? executedTools : undefined,
    };
  }

  /**
   * Synthesize 节点: 整合所有子任务结果
   */
  private async synthesizeNode(
    userId: string,
    agent: AgentConfig,
    originalQuery: string,
    completedTasks: SubTask[],
    knowledgeContext?: string,
  ): Promise<string> {
    const model = agent.model || 'gpt-4o';

    // 构建整合提示词
    const taskResults = completedTasks
      .map(
        (task, index) =>
          `## 子任务 ${index + 1}: ${task.description}\n状态: ${task.status}\n结果: ${task.result || '无结果'}${task.error ? `\n错误: ${task.error}` : ''}`,
      )
      .join('\n\n');

    const systemPrompt = `你是一个专业的结果整合专家。你的任务是将多个子任务的执行结果整合成一个连贯、完整的回复。

要求：
1. 保持回复的完整性和连贯性
2. 突出关键信息和结论
3. 如果某些子任务失败，简要说明并继续整合其他结果
4. 使用清晰的结构和格式
5. 直接回答用户的原始问题`;

    const userPrompt = `原始请求: ${originalQuery}\n\n${knowledgeContext ? `知识库内容:\n${knowledgeContext}\n\n` : ''}子任务执行结果:\n\n${taskResults}\n\n请整合以上结果，给出一个完整的回复。`;

    const response = await this.langGraphService.callLLM({
      userId,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    return response.content;
  }

  /**
   * 构建任务规划系统提示词
   */
  private buildPlanSystemPrompt(
    agent: AgentConfig,
    tools: ToolDefinition[],
    knowledgeContext?: string,
  ): string {
    const parts: string[] = [];

    parts.push(`你是一个任务规划专家。请将用户的请求拆解为具体的子任务列表。`);

    if (agent.instruction) {
      parts.push(`\nAgent 角色设定:\n${agent.instruction}`);
    }

    if (knowledgeContext) {
      parts.push(`\n可用知识库内容:\n${knowledgeContext}`);
    }

    if (tools.length > 0) {
      const toolDescriptions = tools
        .map((t) => `- ${t.function.name}: ${t.function.description}`)
        .join('\n');
      parts.push(`\n可用工具:\n${toolDescriptions}`);
    }

    parts.push(`
任务规划要求：
1. 将请求拆解为 1-3 个核心子任务（不要超过3个，避免超时）
2. 每个子任务应该有明确的目标和可验证的结果
3. 如果任务之间有依赖关系，使用 dependsOn 字段标注
4. 优先并行执行无依赖的任务
5. 子任务描述应该具体、可操作
6. 简单问题可以只返回1个子任务

返回格式（必须严格的 JSON）：
{
  "tasks": [
    {
      "id": "task-1",
      "description": "子任务描述",
      "dependsOn": []
    },
    {
      "id": "task-2",
      "description": "子任务描述",
      "dependsOn": ["task-1"]
    }
  ]
}`);

    return parts.join('\n');
  }

  /**
   * 构建聊天系统提示词
   */
  private buildChatSystemPrompt(
    agent: AgentConfig,
    tools: ToolDefinition[],
    knowledgeContext?: string,
    skillContents?: Array<{ name: string; content: string; inputSchema?: unknown }>,
  ): string {
    const parts: string[] = [];

    if (agent.instruction) {
      parts.push(agent.instruction);
    }

    // 添加 Skill 内容到系统提示词
    if (skillContents && skillContents.length > 0) {
      parts.push('\n## 可用 Skills\n');
      skillContents.forEach((skill) => {
        parts.push(`\n### ${skill.name}\n${skill.content}`);
        if (skill.inputSchema && Array.isArray(skill.inputSchema) && skill.inputSchema.length > 0) {
          parts.push('\n输入参数:');
          skill.inputSchema.forEach((param: { name: string; type: string; description: string }) => {
            parts.push(`- ${param.name} (${param.type}): ${param.description}`);
          });
        }
      });
    }

    if (knowledgeContext) {
      parts.push(`\n可用知识库内容:\n${knowledgeContext}`);
    }

    if (tools.length > 0) {
      const toolDescriptions = tools
        .map((t) => `- ${t.function.name}: ${t.function.description}`)
        .join('\n');
      parts.push(`\n可用工具:\n${toolDescriptions}`);
    }

    return parts.join('\n');
  }

  /**
   * 构建子任务系统提示词
   */
  private buildSubTaskSystemPrompt(agent: AgentConfig, task: SubTask, state: AgentState): string {
    const parts: string[] = [];

    if (agent.instruction) {
      parts.push(agent.instruction);
    }

    parts.push(`\n当前子任务: ${task.description}`);

    // 添加上下文信息（已完成的依赖任务结果）
    if (task.dependsOn && task.dependsOn.length > 0) {
      const contextResults = state.completedTasks
        .filter((t) => task.dependsOn?.includes(t.id))
        .map((t) => `[${t.description}]: ${t.result || '无结果'}`)
        .join('\n');

      if (contextResults) {
        parts.push(`\n依赖任务结果:\n${contextResults}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 从响应中提取 JSON
   */
  private extractJsonFromResponse(content: string): string {
    // 尝试直接解析
    try {
      JSON.parse(content);
      return content;
    } catch {
      // 尝试提取代码块中的 JSON
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        return codeBlockMatch[1].trim();
      }

      // 尝试提取花括号包裹的内容
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return jsonMatch[0];
      }

      throw new Error('无法从响应中提取 JSON');
    }
  }
}
