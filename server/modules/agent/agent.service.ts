import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { agent } from '@server/database/schema';
import { eq, desc, sql } from 'drizzle-orm';
import type {
  AgentConfig,
  AgentListResp,
  CreateAgentRequest,
  UpdateAgentRequest,
} from '@shared/api.interface';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getAgents(): Promise<AgentListResp> {
    try {
      const records = await this.db
        .select()
        .from(agent)
        .orderBy(desc(agent.createdAt));

      const items: AgentConfig[] = records.map((record) => ({
        id: record.id,
        name: record.name,
        description: record.description ?? undefined,
        instruction: record.instruction ?? undefined,
        greeting: record.greeting ?? undefined,
        model: record.model ?? undefined,
        knowledgeBase: record.knowledgeBase ?? undefined,
        tools: record.tools ?? undefined,
        avatarUrl: record.avatarUrl ?? undefined,
        isActive: record.isActive ?? true,
        createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
        updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : String(record.updatedAt),
      }));

      return { items, total: items.length };
    } catch (error) {
      this.logger.error('获取Agent列表失败', JSON.stringify(error));
      throw error;
    }
  }

  async getAgentById(id: string): Promise<AgentConfig | null> {
    try {
      const record = await this.db
        .select()
        .from(agent)
        .where(eq(agent.id, id))
        .limit(1);

      if (!record.length) {
        return null;
      }

      const r = record[0];
      return {
        id: r.id,
        name: r.name,
        description: r.description ?? undefined,
        instruction: r.instruction ?? undefined,
        greeting: r.greeting ?? undefined,
        model: r.model ?? undefined,
        knowledgeBase: r.knowledgeBase ?? undefined,
        tools: r.tools ?? undefined,
        avatarUrl: r.avatarUrl ?? undefined,
        isActive: r.isActive ?? true,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
      };
    } catch (error) {
      this.logger.error('获取Agent详情失败', JSON.stringify(error));
      throw error;
    }
  }

  async createAgent(userId: string, dto: CreateAgentRequest): Promise<AgentConfig> {
    try {
      const result = await this.db
        .insert(agent)
        .values({
          name: dto.name,
          description: dto.description,
          instruction: dto.instruction,
          greeting: dto.greeting,
          model: dto.model,
          knowledgeBase: dto.knowledgeBase,
          tools: dto.tools,
          avatarUrl: dto.avatarUrl,
        })
        .returning();

      const r = result[0];
      return {
        id: r.id,
        name: r.name,
        description: r.description ?? undefined,
        instruction: r.instruction ?? undefined,
        greeting: r.greeting ?? undefined,
        model: r.model ?? undefined,
        knowledgeBase: r.knowledgeBase ?? undefined,
        tools: r.tools ?? undefined,
        avatarUrl: r.avatarUrl ?? undefined,
        isActive: r.isActive ?? true,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
      };
    } catch (error) {
      this.logger.error('创建Agent失败', JSON.stringify(error));
      throw error;
    }
  }

  async updateAgent(id: string, dto: UpdateAgentRequest): Promise<AgentConfig | null> {
    try {
      const updateData: Record<string, unknown> = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.instruction !== undefined) updateData.instruction = dto.instruction;
      if (dto.greeting !== undefined) updateData.greeting = dto.greeting;
      if (dto.model !== undefined) updateData.model = dto.model;
      if (dto.knowledgeBase !== undefined) updateData.knowledgeBase = dto.knowledgeBase;
      if (dto.tools !== undefined) updateData.tools = dto.tools;
      if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      if (Object.keys(updateData).length === 0) {
        return this.getAgentById(id);
      }

      const result = await this.db
        .update(agent)
        .set(updateData)
        .where(eq(agent.id, id))
        .returning();

      if (!result.length) {
        return null;
      }

      const r = result[0];
      return {
        id: r.id,
        name: r.name,
        description: r.description ?? undefined,
        instruction: r.instruction ?? undefined,
        greeting: r.greeting ?? undefined,
        model: r.model ?? undefined,
        knowledgeBase: r.knowledgeBase ?? undefined,
        tools: r.tools ?? undefined,
        avatarUrl: r.avatarUrl ?? undefined,
        isActive: r.isActive ?? true,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
      };
    } catch (error) {
      this.logger.error('更新Agent失败', JSON.stringify(error));
      throw error;
    }
  }

  async deleteAgent(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(agent)
        .where(eq(agent.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      this.logger.error('删除Agent失败', JSON.stringify(error));
      throw error;
    }
  }
}
