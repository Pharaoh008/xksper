import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase, CapabilityService } from '@lark-apaas/fullstack-nestjs-core';
import { tool, skill } from '@server/database/schema';
import { eq } from 'drizzle-orm';
import { mcpClient } from '../chat/mcp.client';
import type { SkillParseResult } from '@shared/api.interface';
import * as AdmZip from 'adm-zip';

@Injectable()
export class ToolService {
  private readonly logger = new Logger(ToolService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    @Inject() private readonly capabilityService: CapabilityService,
  ) {}

  async getTools(type?: string) {
    const tools = await this.db.select().from(tool);

    // 如果是 skill 类型或全部类型，需要关联查询 skill 数据
    if (!type || type === 'skill') {
      const skillTools = tools.filter((t) => t.type === 'skill');
      if (skillTools.length > 0) {
        const toolIds = skillTools.map((t) => t.id);
        const skills = await this.db
          .select()
          .from(skill)
          .where(eq(skill.isActive, true));

        const skillMap = new Map(skills.map((s) => [s.toolId, s]));

        return tools.map((t) => {
          if (t.type === 'skill') {
            return {
              ...t,
              skill: skillMap.get(t.id) || undefined,
            };
          }
          return t;
        });
      }
    }

    return tools;
  }

  async getTool(id: string) {
    const result = await this.db.select().from(tool).where(eq(tool.id, id));
    const toolRecord = result[0] || null;

    if (toolRecord && toolRecord.type === 'skill') {
      const skills = await this.db
        .select()
        .from(skill)
        .where(eq(skill.toolId, id));
      return {
        ...toolRecord,
        skill: skills[0] || undefined,
      };
    }

    return toolRecord;
  }

  async createTool(dto: {
    name: string;
    type: string;
    description?: string;
    configData?: Record<string, unknown>;
    skillData?: {
      name: string;
      description?: string;
      content: string;
      fileType: 'markdown' | 'zip';
      inputSchema?: Array<{ name: string; type: string; description: string; required?: boolean }>;
      outputSchema?: Array<{ name: string; type: string; description: string }>;
      examples?: Array<{ input: Record<string, unknown>; output: string }>;
      metadata?: { author?: string; tags?: string[]; category?: string };
      version?: string;
    };
  }) {
    const result = await this.db
      .insert(tool)
      .values({
        name: dto.name,
        type: dto.type,
        description: dto.description,
        configData: dto.configData || {},
      })
      .returning();

    const newTool = result[0];

    // 如果是 skill 类型，同时创建 skill 记录
    if (dto.type === 'skill' && dto.skillData) {
      const skillResult = await this.db
        .insert(skill)
        .values({
          toolId: newTool.id,
          name: dto.skillData.name,
          description: dto.skillData.description,
          content: dto.skillData.content,
          fileType: dto.skillData.fileType,
          inputSchema: dto.skillData.inputSchema || [],
          outputSchema: dto.skillData.outputSchema || [],
          examples: dto.skillData.examples || [],
          metadata: dto.skillData.metadata || {},
          version: dto.skillData.version || '1.0.0',
          isActive: true,
        })
        .returning();

      return {
        ...newTool,
        skill: skillResult[0],
      };
    }

    return newTool;
  }

  async updateTool(
    id: string,
    dto: {
      name?: string;
      description?: string;
      configData?: Record<string, unknown>;
      isActive?: boolean;
      skillData?: {
        name: string;
        description?: string;
        content: string;
        fileType: 'markdown' | 'zip';
        inputSchema?: Array<{ name: string; type: string; description: string; required?: boolean }>;
        outputSchema?: Array<{ name: string; type: string; description: string }>;
        examples?: Array<{ input: Record<string, unknown>; output: string }>;
        metadata?: { author?: string; tags?: string[]; category?: string };
        version?: string;
      };
    },
  ) {
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.configData !== undefined) updateData.configData = dto.configData;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const result = await this.db
      .update(tool)
      .set(updateData)
      .where(eq(tool.id, id))
      .returning();

    const updatedTool = result[0];

    // 如果提供了 skillData，更新关联的 skill 记录
    if (dto.skillData) {
      const existingSkills = await this.db
        .select()
        .from(skill)
        .where(eq(skill.toolId, id));

      if (existingSkills.length > 0) {
        // 更新现有 skill
        const skillUpdateData: Record<string, unknown> = {};
        if (dto.skillData.name !== undefined) skillUpdateData.name = dto.skillData.name;
        if (dto.skillData.description !== undefined) skillUpdateData.description = dto.skillData.description;
        if (dto.skillData.content !== undefined) skillUpdateData.content = dto.skillData.content;
        if (dto.skillData.inputSchema !== undefined) skillUpdateData.inputSchema = dto.skillData.inputSchema;
        if (dto.skillData.outputSchema !== undefined) skillUpdateData.outputSchema = dto.skillData.outputSchema;
        if (dto.skillData.examples !== undefined) skillUpdateData.examples = dto.skillData.examples;
        if (dto.skillData.metadata !== undefined) skillUpdateData.metadata = dto.skillData.metadata;
        if (dto.skillData.version !== undefined) skillUpdateData.version = dto.skillData.version;

        await this.db.update(skill).set(skillUpdateData).where(eq(skill.toolId, id));
      } else if (updatedTool.type === 'skill') {
        // 创建新的 skill 记录
        await this.db.insert(skill).values({
          toolId: id,
          name: dto.skillData.name,
          description: dto.skillData.description,
          content: dto.skillData.content,
          fileType: dto.skillData.fileType,
          inputSchema: dto.skillData.inputSchema || [],
          outputSchema: dto.skillData.outputSchema || [],
          examples: dto.skillData.examples || [],
          metadata: dto.skillData.metadata || {},
          version: dto.skillData.version || '1.0.0',
          isActive: true,
        });
      }

      // 重新查询获取完整的 tool 和 skill 数据
      return this.getTool(id);
    }

    return updatedTool;
  }

  async deleteTool(id: string) {
    // 先删除关联的 skill 记录
    await this.db.delete(skill).where(eq(skill.toolId, id));
    // 删除 tool 记录
    await this.db.delete(tool).where(eq(tool.id, id));
    return { success: true };
  }

  /**
   * 测试工具连通性
   */
  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const toolRecord = await this.getTool(id);
      if (!toolRecord) {
        return { success: false, message: '工具不存在' };
      }

      const { type, configData } = toolRecord;
      const config = (configData as Record<string, unknown>) || {};

      if (type === 'mcp') {
        return await this.testMcpConnection(config);
      } else if (type === 'cloud_plugin') {
        return await this.testCloudPluginConnection(config);
      } else if (type === 'skill') {
        return await this.testSkillConnection(toolRecord);
      }

      return { success: false, message: `不支持的工具类型: ${type}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`测试工具连通性失败: ${id}`, error);
      return { success: false, message: `连接测试失败: ${errorMessage}` };
    }
  }

  /**
   * 测试 MCP 工具连通性
   */
  private async testMcpConnection(
    config: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    const url = config.url as string;
    const headersArray = config.headers as Array<{ key: string; value: string }> | undefined;

    if (!url) {
      return { success: false, message: 'MCP 配置缺少 URL' };
    }

    // 将数组格式转换为对象格式
    const headers: Record<string, string> = {};
    if (Array.isArray(headersArray)) {
      for (const h of headersArray) {
        if (h.key && h.value) {
          headers[h.key] = h.value;
        }
      }
    }

    try {
      await mcpClient.listTools(url, headers);
      return { success: true, message: 'MCP 服务器连接成功' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `MCP 连接失败: ${errorMessage}` };
    }
  }

  /**
   * 测试云端插件连通性
   */
  private async testCloudPluginConnection(
    config: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    const pluginInstanceId = config.pluginInstanceId as string;

    if (!pluginInstanceId) {
      return { success: false, message: '云端插件配置缺少插件实例 ID' };
    }

    try {
      // 尝试获取插件实例信息来验证连通性
      const pluginInfo = (await this.capabilityService
        .load(pluginInstanceId)
        .call('getPluginInfo', {})) as { name?: string } | undefined;
      return {
        success: true,
        message: `云端插件连接成功: ${pluginInfo?.name || pluginInstanceId}`,
      };
    } catch (error) {
      // 如果 getPluginInfo 不存在，尝试直接调用插件的第一个 action
      try {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.log(`getPluginInfo 调用失败，尝试其他方式: ${errorMessage}`);
        return { success: false, message: `云端插件连接失败: ${errorMessage}` };
      } catch (innerError) {
        const innerMessage = innerError instanceof Error ? innerError.message : String(innerError);
        return { success: false, message: `云端插件连接失败: ${innerMessage}` };
      }
    }
  }

  /**
   * 测试 Skill 连通性
   */
  private async testSkillConnection(
    toolRecord: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    const skillData = toolRecord.skill as Record<string, unknown> | undefined;

    if (!skillData) {
      return { success: false, message: 'Skill 数据不存在' };
    }

    // 验证 skill 基本结构
    if (!skillData.name || !skillData.content) {
      return { success: false, message: 'Skill 缺少必要字段（name 或 content）' };
    }

    return { success: true, message: `Skill "${skillData.name}" 验证通过` };
  }

  /**
   * 解析 Skill 文件（Markdown 或 Zip）
   */
  async parseSkillFile(file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<{
    success: boolean;
    data?: SkillParseResult;
    message?: string;
  }> {
    try {
      const fileName = file.originalname.toLowerCase();
      const isMarkdown = fileName.endsWith('.md') || fileName.endsWith('.markdown');
      const isZip = fileName.endsWith('.zip');

      if (!isMarkdown && !isZip) {
        return { success: false, message: '仅支持 Markdown (.md) 或 Zip (.zip) 文件' };
      }

      const content = file.buffer.toString('utf-8');

      if (isMarkdown) {
        return this.parseMarkdownSkill(content, 'markdown');
      } else {
        return this.parseZipSkill(file.buffer);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('解析 Skill 文件失败', error);
      return { success: false, message: `解析失败: ${errorMessage}` };
    }
  }

  /**
   * 从 base64 字符串解析 Skill 文件（用于前端读取文件后通过 JSON 发送）
   */
  async parseSkillFileFromBase64(
    fileName: string,
    base64Content: string,
  ): Promise<{ success: boolean; data?: SkillParseResult; message?: string }> {
    try {
      const fileNameLower = fileName.toLowerCase();
      const isMarkdown = fileNameLower.endsWith('.md') || fileNameLower.endsWith('.markdown');
      const isZip = fileNameLower.endsWith('.zip');

      if (!isMarkdown && !isZip) {
        return { success: false, message: '仅支持 Markdown (.md) 或 Zip (.zip) 文件' };
      }

      const buffer = Buffer.from(base64Content, 'base64');

      if (isMarkdown) {
        const content = buffer.toString('utf-8');
        const result = this.parseMarkdownSkill(content, 'markdown');
        if (result.success && result.data) {
          result.data.content = base64Content;
        }
        return result;
      } else {
        return this.parseZipSkill(buffer);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('解析 Skill 文件失败', error);
      return { success: false, message: `解析失败: ${errorMessage}` };
    }
  }

  /**
   * 解析 Zip Skill 文件
   */
  private parseZipSkill(buffer: Buffer): { success: boolean; data?: SkillParseResult; message?: string } {
    try {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();

      // 查找 SKILL.md 文件
      const skillEntry = entries.find((entry) => entry.entryName.toLowerCase() === 'skill.md');

      if (!skillEntry) {
        return { success: false, message: 'Zip 文件中未找到 SKILL.md' };
      }

      const mdContent = skillEntry.getData().toString('utf-8');
      const result = this.parseMarkdownSkill(mdContent);

      if (result.success && result.data) {
        // 添加 base64 编码的 zip 内容
        result.data.content = buffer.toString('base64');
        result.data.fileType = 'zip';
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `解析 Zip 文件失败: ${errorMessage}` };
    }
  }

  /**
   * 解析 Markdown Skill 文件
   */
  private parseMarkdownSkill(content: string, fileType?: 'markdown' | 'zip'): { success: boolean; data?: SkillParseResult; message?: string } {
    try {
      // 解析 YAML Front Matter
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

      if (!frontMatterMatch) {
        return { success: false, message: 'Markdown 文件缺少 YAML Front Matter' };
      }

      const yamlContent = frontMatterMatch[1];
      const markdownBody = frontMatterMatch[2].trim();

      // 解析 YAML
      const metadata = this.parseYaml(yamlContent);

      // 检测是否为 Openclaw 格式
      const metadataObj = metadata.metadata as Record<string, unknown> | undefined;
      const openclawMeta = metadataObj?.openclaw || (metadata.openclaw as unknown);
      const isOpenclaw = !!openclawMeta;

      // 构建解析结果
      const result: SkillParseResult = {
        name: String(metadata.name || 'Unnamed Skill'),
        description: String(metadata.description || ''),
        inputSchema: (metadata.inputSchema as Array<{ name: string; type: string; description: string; required?: boolean }>) || [],
        outputSchema: (metadata.outputSchema as Array<{ name: string; type: string; description: string }>) || [],
        examples: (metadata.examples as Array<{ input: Record<string, unknown>; output: string }>) || [],
        metadata: {
          author: metadata.author ? String(metadata.author) : undefined,
          tags: (metadata.tags as string[]) || [],
          category: metadata.category ? String(metadata.category) : undefined,
        },
        version: String(metadata.version || '1.0.0'),
      };

      // 如果没有提供 description，尝试从 markdown body 提取第一段
      if (!result.description && markdownBody) {
        const firstParagraph = markdownBody.split('\n\n')[0].trim();
        if (firstParagraph) {
          result.description = firstParagraph.substring(0, 200);
        }
      }

      // Openclaw 格式适配：提供默认的 input/output schema
      if (isOpenclaw) {
        // 如果没有提供 inputSchema，提供 Openclaw 默认的参数结构
        if (result.inputSchema.length === 0) {
          result.inputSchema = [
            {
              name: 'prompt',
              type: 'string',
              description: 'User request or command for the skill',
              required: true,
            },
          ];
        }
        // 如果没有提供 outputSchema，提供默认输出
        if (result.outputSchema.length === 0) {
          result.outputSchema = [
            {
              name: 'result',
              type: 'string',
              description: 'Skill execution result',
            },
          ];
        }
      }

      // 如果是直接上传的 markdown 文件，添加 content
      if (fileType === 'markdown') {
        result.content = content;
        result.fileType = 'markdown';
      }

      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `解析 Markdown 失败: ${errorMessage}` };
    }
  }

  /**
   * 简单 YAML 解析器
   */
  private parseYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    let currentKey: string | null = null;
    let currentArray: unknown[] | null = null;
    let currentObject: Record<string, unknown> | null = null;
    let indentLevel = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const leadingSpaces = line.length - line.trimStart().length;

      // 数组元素
      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim();
        if (currentArray) {
          // 解析对象数组
          if (value.includes(':')) {
            if (!currentObject) {
              currentObject = {};
            }
            const [key, ...rest] = value.split(':');
            const val = rest.join(':').trim();
            currentObject[key.trim()] = this.parseYamlValue(val);
          } else {
            if (currentObject && Object.keys(currentObject).length > 0) {
              currentArray.push({ ...currentObject });
              currentObject = null;
            }
            currentArray.push(this.parseYamlValue(value));
          }
        }
        continue;
      }

      // 键值对
      if (trimmed.includes(':')) {
        // 保存之前的对象到数组
        if (currentArray && currentObject && Object.keys(currentObject).length > 0) {
          currentArray.push({ ...currentObject });
          currentObject = null;
        }

        const [key, ...rest] = trimmed.split(':');
        const keyTrimmed = key.trim();
        const value = rest.join(':').trim();

        if (value) {
          result[keyTrimmed] = this.parseYamlValue(value);
          currentKey = null;
          currentArray = null;
        } else {
          // 可能是数组或嵌套对象的开始
          currentKey = keyTrimmed;
          currentArray = [];
          result[currentKey] = currentArray;
        }
      }
    }

    // 处理最后一个对象
    if (currentArray && currentObject && Object.keys(currentObject).length > 0) {
      currentArray.push({ ...currentObject });
    }

    return result;
  }

  /**
   * 解析 YAML 值
   */
  private parseYamlValue(value: string): unknown {
    const trimmed = value.trim();

    // 布尔值
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // null
    if (trimmed === 'null' || trimmed === '~') return null;

    // 数字
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

    // 数组
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }

    // 对象
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }

    // 字符串（去除引号）
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    return trimmed;
  }
}
