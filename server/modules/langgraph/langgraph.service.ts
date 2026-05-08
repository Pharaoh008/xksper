import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { llmConfig, tool, knowledgeBase, knowledgeDocument, skill } from '@server/database/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import { ConfigService } from '../config/config.service';
import { mcpClient } from '../chat/mcp.client';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class LangGraphService {
  private readonly logger = new Logger(LangGraphService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 调用 LLM
   */
  async callLLM(params: {
    userId: string;
    model: string;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
  }): Promise<LLMResponse> {
    const { userId, model, messages, tools } = params;

    const config = await this.configService.getConfigStatus(userId);
    if (!config.isValid) {
      throw new Error('API配置无效，请先配置有效的API Key');
    }

    const baseUrl = config.baseUrl;
    const apiKey = await this.getApiKey(userId);

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 25000, // 单个LLM调用25秒超时，避免整体超时
      },
    );

    const { choices, usage } = response.data;
    const message = choices[0]?.message;

    if (!message) {
      throw new Error('API响应格式异常');
    }

    return {
      content: message.content || '',
      toolCalls: message.tool_calls,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * 获取工具定义（仅 MCP 工具）
   */
  async getTools(toolIds: string[]): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];

    for (const toolId of toolIds) {
      try {
        const result = await this.db
          .select({
            type: tool.type,
            configData: tool.configData,
            isActive: tool.isActive,
          })
          .from(tool)
          .where(eq(tool.id, toolId))
          .limit(1);

        const toolInfo = result[0];
        if (!toolInfo || toolInfo.type !== 'mcp' || !toolInfo.isActive) continue;

        const config = toolInfo.configData as { url?: string; headers?: Array<{ key: string; value: string }> };
        if (!config?.url) continue;

        const headers = config.headers?.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
        const mcpTools = await mcpClient.getToolsForLlm(config.url, headers);
        tools.push(...mcpTools);
      } catch (err) {
        this.logger.error(`获取工具定义失败: ${toolId}`, err);
      }
    }

    return tools;
  }

  /**
   * 获取 Skill 工具内容
   */
  async getSkillContents(toolIds: string[]): Promise<Array<{ name: string; content: string; inputSchema?: unknown }>> {
    const skills: Array<{ name: string; content: string; inputSchema?: unknown }> = [];

    for (const toolId of toolIds) {
      try {
        const result = await this.db
          .select({
            type: tool.type,
            isActive: tool.isActive,
          })
          .from(tool)
          .where(eq(tool.id, toolId))
          .limit(1);

        const toolInfo = result[0];
        if (!toolInfo || toolInfo.type !== 'skill' || !toolInfo.isActive) continue;

        const skillResult = await this.db
          .select({
            name: skill.name,
            content: skill.content,
            inputSchema: skill.inputSchema,
          })
          .from(skill)
          .where(eq(skill.toolId, toolId))
          .limit(1);

        if (skillResult.length > 0) {
          skills.push(skillResult[0]);
        }
      } catch (err) {
        this.logger.error(`获取 Skill 内容失败: ${toolId}`, err);
      }
    }

    return skills;
  }

  /**
   * 执行工具调用
   */
  async executeTools(toolCalls: ToolCall[], toolIds: string[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, unknown>;
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        toolArgs = {};
      }

      let executed = false;
      for (const toolId of toolIds) {
        try {
          const result = await this.db
            .select({
              type: tool.type,
              configData: tool.configData,
              isActive: tool.isActive,
            })
            .from(tool)
            .where(eq(tool.id, toolId))
            .limit(1);

          const toolInfo = result[0];
          if (!toolInfo || toolInfo.type !== 'mcp' || !toolInfo.isActive) continue;

          const config = toolInfo.configData as { url?: string; headers?: Array<{ key: string; value: string }> };
          if (!config?.url) continue;

          const headers = config.headers?.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});

          this.logger.log(`执行工具: ${toolName}, args: ${JSON.stringify(toolArgs)}`);
          const toolResult = await mcpClient.callTool(config.url, toolName, toolArgs, headers);

          results.push({
            toolCallId: toolCall.id,
            name: toolName,
            result: toolResult,
          });
          executed = true;
          break;
        } catch (err) {
          this.logger.error(`工具执行失败: ${toolName}`, err);
        }
      }

      if (!executed) {
        results.push({
          toolCallId: toolCall.id,
          name: toolName,
          result: `工具执行失败: ${toolName}`,
        });
      }
    }

    return results;
  }

  /**
   * 检索知识库
   */
  async retrieveKnowledge(knowledgeBaseIds: string[]): Promise<string> {
    const contexts: string[] = [];

    for (const kbId of knowledgeBaseIds) {
      try {
        const kbResult = await this.db
          .select({ name: knowledgeBase.name })
          .from(knowledgeBase)
          .where(eq(knowledgeBase.id, kbId))
          .limit(1);

        const kb = kbResult[0];
        if (!kb) continue;

        const docs = await this.db
          .select({
            name: knowledgeDocument.name,
            content: knowledgeDocument.content,
          })
          .from(knowledgeDocument)
          .where(eq(knowledgeDocument.knowledgeBaseId, kbId))
          .limit(5);

        if (docs.length === 0) continue;

        const contents = docs
          .filter((d) => d.content)
          .map((d) => `- ${d.name}:\n${d.content?.substring(0, 1000)}`)
          .join('\n\n');

        if (contents) {
          contexts.push(`【知识库: ${kb.name}】\n${contents}`);
        }
      } catch (err) {
        this.logger.error(`检索知识库失败: ${kbId}`, err);
      }
    }

    return contexts.length > 0
      ? `=== 相关知识库内容 ===\n${contexts.join('\n\n')}\n=== 知识库内容结束 ===\n`
      : '';
  }

  private async getApiKey(userId: string): Promise<string> {
    const result = await this.db
      .select({ apiKey: llmConfig.apiKey })
      .from(llmConfig)
      .where(eq(llmConfig.userId, userId))
      .limit(1);

    if (result.length === 0 || !result[0].apiKey) {
      return '';
    }

    return Buffer.from(result[0].apiKey, 'base64').toString('utf-8');
  }
}
