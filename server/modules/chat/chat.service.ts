import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { conversation, message, tokenUsage, llmConfig, tool, knowledgeBase, knowledgeDocument, skill } from '@server/database/schema';
import { eq, like } from 'drizzle-orm';
import axios from 'axios';
import type {
  LlmModel,
  ModelListResp,
  ChatRequest,
  ChatResp,
  TokenUsage,
  Mention,
} from '@shared/api.interface';
import { ConfigService } from '../config/config.service';
import { FileParserService } from '../file/file-parser.service';
import { mcpClient } from './mcp.client';
import * as AdmZip from 'adm-zip';

/** 图片URL转base64 */
async function urlToBase64(imageUrl: string): Promise<string> {
  try {
    // 如果已经是 base64 格式，直接返回
    if (imageUrl.startsWith('data:image/')) {
      return imageUrl;
    }
    
    // 下载图片
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    // 获取图片的 MIME 类型
    const contentType = response.headers['content-type'] || 'image/png';
    
    // 转为 base64
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    this.logger.error(`图片下载失败: ${imageUrl}`, error);
    throw new Error(`无法下载图片: ${imageUrl}`);
  }
}

/** 处理消息中的图片URL，转为base64 */
async function processMessageContent(
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>,
): Promise<string | Array<{ type: string; text?: string; image_url?: { url: string } }>> {
  if (typeof content === 'string') {
    return content;
  }
  
  // 处理多模态内容
  const processed = await Promise.all(
    content.map(async (item) => {
      if (item.type === 'image_url' && item.image_url?.url) {
        const base64Url = await urlToBase64(item.image_url.url);
        return {
          type: 'image_url',
          image_url: { url: base64Url },
        };
      }
      return item;
    }),
  );
  
  return processed;
}

/** 模型定价表 (单位: 每千token人民币)
 * 价格来源: 用户提供定价 (¥/1M tokens) / 1000 = ¥/1K tokens
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude 模型 (用户提供价格)
  'claude-haiku-4-5-20251001': { input: 0.001, output: 0.005 },
  'claude-opus-4-6': { input: 0.005, output: 0.025 },
  'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  // GPT 模型 (用户提供价格)
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-5.4': { input: 0.0025, output: 0.015 },
  'gpt-5.2': { input: 0.0025, output: 0.012 },
  // Gemini 模型 (估算价格)
  'gemini-2.5-flash-image': { input: 0.001, output: 0.003 },
  'gemini-3-pro-image-preview': { input: 0.0035, output: 0.0105 },
  // 其他模型默认使用成本价
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gemini-pro': { input: 0.001, output: 0.002 },
  'gemini-1.5-pro': { input: 0.0035, output: 0.0105 },
  'deepseek-chat': { input: 0.00014, output: 0.00028 },
  'deepseek-coder': { input: 0.00014, output: 0.00028 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
};

/** wcnb.ai 支持的模型列表 */
const AVAILABLE_MODELS: LlmModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', type: 'gpt' },
  { id: 'gpt-5.2', name: 'GPT-5.2', type: 'gpt' },
  { id: 'gpt-5.4', name: 'GPT-5.4', type: 'gpt' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku', type: 'claude' },
  { id: 'claude-opus-4-6', name: 'Claude Opus', type: 'claude' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet', type: 'claude' },
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5', type: 'gemini' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3', type: 'gemini' },
];

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly configService: ConfigService,
    private readonly fileParserService: FileParserService,
  ) {}

  /**
   * 获取可用模型列表
   */
  getModels(): ModelListResp {
    return { models: AVAILABLE_MODELS };
  }

  /**
   * 计算Token费用
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      this.logger.warn(`未找到模型 ${model} 的定价信息，使用默认定价`);
      return 0;
    }
    const inputCost = (promptTokens / 1000) * pricing.input;
    const outputCost = (completionTokens / 1000) * pricing.output;
    return Math.round((inputCost + outputCost) * 10000) / 10000;
  }

  /**
   * 处理@引用，返回增强后的上下文
   */
  private async processMentions(mentions: Mention[], query: string): Promise<string> {
    this.logger.log(`processMentions: ${mentions.length} mentions, query: ${query}`);
    const contextParts: string[] = [];

    for (const mention of mentions) {
      this.logger.log(`处理 mention: type=${mention.type}, id=${mention.id}, name=${mention.name}`);
      if (mention.type === 'knowledge') {
        const kbContext = await this.retrieveKnowledge(mention.id, query);
        this.logger.log(`知识库召回结果长度: ${kbContext?.length || 0}`);
        if (kbContext) {
          contextParts.push(`【知识库: ${mention.name}】\n${kbContext}`);
        }
      } else if (mention.type === 'tool') {
        const toolInfo = await this.getToolInfo(mention.id);
        if (toolInfo) {
          contextParts.push(`【工具: ${mention.name}】\n类型: ${toolInfo.type}\n描述: ${toolInfo.description || '无'}\n配置: ${JSON.stringify(toolInfo.configData, null, 2)}`);
        }
      }
    }

    return contextParts.length > 0 ? `\n\n=== 引用资源 ===\n${contextParts.join('\n\n')}\n=== 引用结束 ===\n\n` : '';
  }

  /**
   * 检索知识库内容
   */
  private async retrieveKnowledge(knowledgeBaseId: string, query: string): Promise<string | null> {
    this.logger.log(`retrieveKnowledge: kbId=${knowledgeBaseId}`);
    try {
      const docs = await this.db
        .select({
          name: knowledgeDocument.name,
          content: knowledgeDocument.content,
        })
        .from(knowledgeDocument)
        .where(eq(knowledgeDocument.knowledgeBaseId, knowledgeBaseId))
        .limit(5);

      if (docs.length === 0) return null;

      const kb = await this.db
        .select({ name: knowledgeBase.name })
        .from(knowledgeBase)
        .where(eq(knowledgeBase.id, knowledgeBaseId))
        .limit(1);

      const kbName = kb[0]?.name || '未知知识库';
      const contents = docs
        .filter((d) => d.content)
        .map((d) => `- ${d.name}:\n${d.content?.substring(0, 1000)}`)
        .join('\n\n');

      return contents ? `知识库「${kbName}」相关文档:\n\n${contents}` : null;
    } catch (error) {
      this.logger.error(`检索知识库失败: ${knowledgeBaseId}`, error);
      return null;
    }
  }

  /**
   * 获取工具信息
   */
  private async getToolInfo(toolId: string): Promise<
    | { type: string; description: string; configData: unknown; skill?: { name: string; content: string; inputSchema: unknown; outputSchema: unknown; fileType: string } }
    | null
  > {
    try {
      const result = await this.db
        .select({
          type: tool.type,
          description: tool.description,
          configData: tool.configData,
        })
        .from(tool)
        .where(eq(tool.id, toolId))
        .limit(1);

      const toolInfo = result[0];
      if (!toolInfo) return null;

      // 如果是 Skill 类型工具，关联查询 Skill 数据
      if (toolInfo.type === 'skill') {
        const skillResult = await this.db
          .select({
            name: skill.name,
            content: skill.content,
            inputSchema: skill.inputSchema,
            outputSchema: skill.outputSchema,
            fileType: skill.fileType,
          })
          .from(skill)
          .where(eq(skill.toolId, toolId))
          .limit(1);

        if (skillResult.length > 0) {
          return {
            ...toolInfo,
            skill: skillResult[0],
          };
        }
      }

      return toolInfo;
    } catch (error) {
      this.logger.error(`获取工具信息失败: ${toolId}`, error);
      return null;
    }
  }

  /**
   * 发送对话请求
   */
  async sendChat(userId: string, dto: ChatRequest): Promise<ChatResp> {
    const { model, messages, conversationId, mentions } = dto;

    this.logger.log(`sendChat called, mentions: ${mentions?.length || 0}`);
    if (mentions && mentions.length > 0) {
      this.logger.log(`Mentions: ${JSON.stringify(mentions)}`);
    }

    // 1. 获取用户配置
    const config = await this.configService.getConfigStatus(userId);
    if (!config.isValid) {
      throw new Error('API配置无效，请先配置有效的API Key');
    }

    const baseUrl = config.baseUrl;
    const apiKey = await this.decryptApiKeyFromConfig(userId);

    // 2. 处理消息内容，支持多模态（将图片URL转为base64）
    const processedMessages = await Promise.all(
      messages.map(async (m) => {
        const processedContent = await processMessageContent(m.content);
        
        // 检查是否有文件附件需要解析
        if (m.attachments && m.attachments.length > 0) {
          const attachmentContents = await Promise.all(
            m.attachments.map(async (attachment) => {
              this.logger.log(`解析附件: ${attachment.fileName}, MIME: ${attachment.mimeType}`);
              try {
                const buffer = Buffer.from(attachment.base64Data, 'base64');
                const parsed = await this.fileParserService.parseFile(
                  buffer,
                  attachment.mimeType,
                  attachment.fileName,
                );
                return `\n[附件: ${attachment.fileName}]\n${parsed.content}\n`;
              } catch (error) {
                this.logger.error(`附件解析失败: ${attachment.fileName}`, error);
                return `\n[附件: ${attachment.fileName} - 解析失败]\n`;
              }
            }),
          );
          
          // 将附件内容追加到消息中
          const attachmentText = attachmentContents.join('\n');
          if (typeof processedContent === 'string') {
            return { role: m.role, content: processedContent + attachmentText };
          } else {
            // 多模态消息，将附件作为文本追加
            return {
              role: m.role,
              content: [...processedContent, { type: 'text', text: attachmentText }],
            };
          }
        }
        
        return { role: m.role, content: processedContent };
      }),
    );

    // 3. 处理@引用 - 知识库、MCP工具和Skill
    let mcpTools: Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> = [];
    let mcpConfig: { url: string; headers?: Record<string, string> } | null = null;
    const skillPrompts: string[] = [];

    if (mentions && mentions.length > 0) {
      this.logger.log(`处理 ${mentions.length} 个 mentions`);

      // 处理知识库mention
      const lastUserMsg = processedMessages.filter((m) => m.role === 'user').pop();
      if (lastUserMsg && typeof lastUserMsg.content === 'string') {
        const lastContent = lastUserMsg.content;
        const queryText = lastContent.replace(/\[@(?:knowledge|tool):[^:]+:[^\]]+\]/g, '').trim();
        this.logger.log(`用户查询: ${queryText}`);
        const context = await this.processMentions(mentions, queryText);
        this.logger.log(`召回上下文长度: ${context?.length || 0}`);
        if (context) {
          lastUserMsg.content = `${queryText}\n${context}`;
          this.logger.log(`增强后消息长度: ${lastUserMsg.content.length}`);
        }
      }

      // 处理工具mention - MCP工具和Skill
      const toolMentions = mentions.filter((m) => m.type === 'tool');
      if (toolMentions.length > 0) {
        for (const mention of toolMentions) {
          const toolInfo = await this.getToolInfo(mention.id);
          if (!toolInfo) continue;

          if (toolInfo.type === 'mcp') {
            // MCP 工具处理
            const config = toolInfo.configData as { url?: string; headers?: Array<{ key: string; value: string }> };
            if (config?.url) {
              mcpConfig = {
                url: config.url,
                headers: config.headers?.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
              };
              try {
                mcpTools = await mcpClient.getToolsForLlm(mcpConfig.url, mcpConfig.headers);
                this.logger.log(`获取到 ${mcpTools.length} 个 MCP 工具定义`);
              } catch (err) {
                this.logger.error(`获取 MCP 工具列表失败: ${mcpConfig.url}`, err);
              }
            }
          } else if (toolInfo.type === 'skill' && toolInfo.skill) {
            // Skill 工具处理 - 将 Skill 内容作为提示词
            const skillFileType = toolInfo.skill.fileType;
            let skillContent = toolInfo.skill.content;
            const skillName = toolInfo.skill.name;
            const inputSchema = toolInfo.skill.inputSchema as Array<{ name: string; type: string; description: string }> || [];

            // 如果是 zip 格式，解压并提取 SKILL.md 内容
            if (skillFileType === 'zip' && skillContent) {
              try {
                const zipBuffer = Buffer.from(skillContent, 'base64');
                const zip = new AdmZip(zipBuffer);
                const entries = zip.getEntries();
                const skillEntry = entries.find((entry) => entry.entryName.toLowerCase() === 'skill.md');
                if (skillEntry) {
                  skillContent = skillEntry.getData().toString('utf-8');
                  this.logger.log(`从 zip 中提取 SKILL.md 成功: ${skillName}`);
                } else {
                  this.logger.warn(`Zip 中未找到 SKILL.md: ${skillName}`);
                  continue;
                }
              } catch (err) {
                this.logger.error(`解压 Skill zip 失败: ${skillName}`, err);
                continue;
              }
            }

            let skillPrompt = `## Skill: ${skillName}\n\n${skillContent}`;

            // 如果有输入参数定义，添加到提示词
            if (inputSchema.length > 0) {
              skillPrompt += '\n\n### 输入参数:\n';
              inputSchema.forEach((param) => {
                skillPrompt += `- ${param.name} (${param.type}): ${param.description}\n`;
              });
            }

            skillPrompts.push(skillPrompt);
            this.logger.log(`加载 Skill: ${skillName}`);
          }
        }
      }

      // 如果有 Skill 提示词，添加到系统消息或用户消息前
      if (skillPrompts.length > 0 && lastUserMsg) {
        const combinedSkillPrompt = skillPrompts.join('\n\n---\n\n');
        const enhancedContent = `[系统指令] 请使用以下 Skill 来完成任务:\n\n${combinedSkillPrompt}\n\n[用户请求]\n${lastUserMsg.content}`;
        lastUserMsg.content = enhancedContent;
        this.logger.log(`已注入 ${skillPrompts.length} 个 Skill 提示词`);
      }
    }

    try {
      // 4. 调用wcnb.ai API（支持工具调用）
      const requestBody: Record<string, unknown> = {
        model,
        messages: processedMessages,
        stream: false,
      };
      
      // 如果有MCP工具，添加到tools参数
      if (mcpTools.length > 0) {
        requestBody.tools = mcpTools;
        requestBody.tool_choice = 'auto';
        this.logger.log(`添加 ${mcpTools.length} 个工具到请求`);
      }

      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 45000,  // 45秒超时，确保总时间在FaaS限制内
        },
      );

      let { id, usage, choices } = response.data;
      let assistantMessage = choices[0]?.message;

      if (!assistantMessage) {
        throw new Error('API响应格式异常：未找到assistant消息');
      }

      // 处理工具调用
      if (assistantMessage.tool_calls && mcpConfig) {
        this.logger.log(`检测到工具调用: ${assistantMessage.tool_calls.length} 个`);
        
        // 将 assistant 的 tool_calls 消息添加到对话
        processedMessages.push({
          role: 'assistant' as const,
          content: `我需要使用工具：${assistantMessage.tool_calls.map((t: { function: { name: string } }) => t.function.name).join(', ')}`,
        });

        // 执行每个工具调用
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            toolArgs = {};
          }

          this.logger.log(`执行工具: ${toolName}, args: ${JSON.stringify(toolArgs)}`);
          
          try {
            const toolResult = await mcpClient.callTool(
              mcpConfig.url,
              toolName,
              toolArgs,
              mcpConfig.headers,
            );
            
            // 添加工具结果到对话（使用unknown转换绕过类型检查）
            processedMessages.push({
              role: 'assistant' as const,
              content: `[工具结果: ${toolName}]\n${toolResult}`,
            } as unknown as typeof processedMessages[0]);
            this.logger.log(`工具执行结果: ${toolResult.substring(0, 200)}...`);
          } catch (err) {
            this.logger.error(`工具执行失败: ${toolName}`, err);
            processedMessages.push({
              role: 'assistant' as const,
              content: `[工具执行失败: ${toolName}]\n${err instanceof Error ? err.message : String(err)}`,
            } as unknown as typeof processedMessages[0]);
          }
        }

        // 再次调用 LLM 获取最终回复
        this.logger.log('发送工具结果给 LLM 生成最终回复');
        const finalResponse = await axios.post(
          `${baseUrl}/chat/completions`,
          {
            model,
            messages: processedMessages,
            stream: false,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: 45000,  // 45秒超时，确保总时间在FaaS限制内
          },
        );

        id = finalResponse.data.id;
        usage = finalResponse.data.usage;
        assistantMessage = finalResponse.data.choices[0]?.message;
        this.logger.log('获取到最终回复');
      }

      // 处理多模态内容
      type ContentItem = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
      let responseContent: string | ContentItem[] = '';
      
      const rawContent = assistantMessage.content;
      
      if (Array.isArray(rawContent)) {
        // 多模态响应 - 已经是数组格式
        responseContent = rawContent.map((item: { type: string; text?: string; image_url?: { url: string } }) => {
          if (item.type === 'text') {
            return { type: 'text' as const, text: item.text || '' };
          }
          return { type: 'image_url' as const, image_url: item.image_url || { url: '' } };
        });
      } else if (typeof rawContent === 'string') {
        // 检查是否包含 Markdown 格式的 base64 图片
        const markdownImageRegex = /!\[([^\]]*)\]\((data:image\/[^;)]+;base64,[A-Za-z0-9+/=]+)\)/g;
        const matches = Array.from(rawContent.matchAll(markdownImageRegex));
        
        if (matches.length > 0) {
          // 包含 base64 图片，转换为多模态格式
          const items: ContentItem[] = [];
          let lastIndex = 0;
          
          for (const match of matches) {
            // 添加图片前的文本
            if (match.index! > lastIndex) {
              const textBefore = rawContent.substring(lastIndex, match.index).trim();
              if (textBefore) {
                items.push({ type: 'text', text: textBefore });
              }
            }
            // 添加图片
            items.push({
              type: 'image_url',
              image_url: { url: match[2] }
            });
            lastIndex = match.index! + match[0].length;
          }
          
          // 添加最后剩余的文本
          const textAfter = rawContent.substring(lastIndex).trim();
          if (textAfter) {
            items.push({ type: 'text', text: textAfter });
          }
          
          responseContent = items;
        } else {
          // 纯文本响应
          responseContent = rawContent;
        }
      } else {
        responseContent = '';
      }

      const tokenUsageData: TokenUsage = {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
        cost: this.calculateCost(model, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0),
      };

      // 5. 确定或创建会话
      let convId = conversationId;
      if (!convId) {
        const firstUserMessage = messages.find((m) => m.role === 'user');
        const firstContent = Array.isArray(firstUserMessage?.content)
          ? firstUserMessage.content.find((c) => c.type === 'text')?.text || '新对话'
          : firstUserMessage?.content || '新对话';
        // 生成简短标题：取前10个字符，超过则添加省略号
        const title = firstContent.substring(0, 10) + (firstContent.length > 10 ? '...' : '');

        const [convResult] = await this.db
          .insert(conversation)
          .values({
            userId,
            title,
            model,
            messageCount: 0,
          })
          .returning();
        convId = convResult.id;
      }

      // 6. 保存用户最后一条消息
      const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMessage) {
        const contentText = Array.isArray(lastUserMessage.content)
          ? lastUserMessage.content.find((c) => c.type === 'text')?.text || ''
          : lastUserMessage.content;
        await this.db.insert(message).values({
          conversationId: convId,
          role: 'user',
          content: contentText,
          tokenUsage: tokenUsageData.promptTokens,
          mentions: mentions && mentions.length > 0 ? mentions : null,
        });
      }

      // 7. 保存AI回复（将多模态内容转为JSON字符串存储）
      const contentToSave = Array.isArray(responseContent) 
        ? JSON.stringify(responseContent)
        : responseContent;
      await this.db.insert(message).values({
        conversationId: convId,
        role: 'assistant',
        content: contentToSave,
        tokenUsage: tokenUsageData.completionTokens,
      });

      // 8. 更新会话消息数量
      await this.db
        .update(conversation)
        .set({
          messageCount: this.db.$count(message, eq(message.conversationId, convId)),
          updatedAt: new Date(),
        })
        .where(eq(conversation.id, convId));

      // 9. 记录Token消耗
      await this.db.insert(tokenUsage).values({
        userId,
        conversationId: convId,
        model,
        promptTokens: tokenUsageData.promptTokens,
        completionTokens: tokenUsageData.completionTokens,
        totalTokens: tokenUsageData.totalTokens,
        cost: tokenUsageData.cost,
      });

      return {
        id,
        role: 'assistant',
        content: responseContent,
        tokenUsage: tokenUsageData,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          this.logger.error(`API请求超时: model=${model}, timeout=120s`);
          throw new Error('请求超时（超过60秒）。当前模型响应较慢，建议：1）简化问题重试 2）切换至响应更快的模型如claude-haiku 3）检查wcnb.ai服务状态');
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          this.logger.error(`API连接失败: baseUrl=${baseUrl}, code=${error.code}`);
          throw new Error('无法连接到API服务器，请检查网络或API配置');
        }
        const errorMessage = error.response?.data?.error?.message || error.message;
        this.logger.error(`调用wcnb.ai API失败: ${errorMessage}`, error.stack);
        
        // 检测模型通道不可用的特定错误
        if (errorMessage?.includes('No available channel for model')) {
          const match = errorMessage.match(/No available channel for model ([^\s]+)/);
          const modelName = match ? match[1] : model;
          throw new Error(`模型 "${modelName}" 当前不可用，您的账户可能无权访问此模型，或该模型通道暂时关闭。请尝试切换到其他模型。`);
        }

        // 检测上游服务错误
        if (errorMessage?.includes('upstream error') || errorMessage?.includes('do request failed')) {
          this.logger.error(`上游服务错误 - model: ${model}, baseUrl: ${baseUrl}, error: ${errorMessage}`);
          throw new Error(`AI服务暂时不可用，可能是上游服务商故障或网络连接问题。请稍后重试，或尝试切换其他模型。(模型: ${model})`);
        }

        // 检测认证错误
        if (error.response?.status === 401 || errorMessage?.includes('invalid_api_key') || errorMessage?.includes('unauthorized')) {
          throw new Error('API密钥无效或已过期，请检查配置管理中的API设置');
        }

        // 检测请求频率限制
        if (error.response?.status === 429 || errorMessage?.includes('rate_limit') || errorMessage?.includes('too many requests')) {
          throw new Error('请求过于频繁，请稍后再试');
        }

        // 检测余额不足
        if (errorMessage?.includes('insufficient_quota') || errorMessage?.includes('余额不足')) {
          throw new Error('账户余额不足，请前往 wcnb.ai 充值后再试');
        }

        throw new Error(`API调用失败: ${errorMessage}`);
      }
      this.logger.error(
        `发送对话失败: userId=${userId}, model=${model}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 解密存储的API Key
   */
  private async decryptApiKeyFromConfig(userId: string): Promise<string> {
    const config = await this.db
      .select({ apiKey: llmConfig.apiKey })
      .from(llmConfig)
      .where(eq(llmConfig.userId, userId))
      .limit(1);

    if (config.length === 0 || !config[0].apiKey) {
      throw new Error('未找到API配置');
    }

    return Buffer.from(config[0].apiKey, 'base64').toString('utf-8');
  }
}
