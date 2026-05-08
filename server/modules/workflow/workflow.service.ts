import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq } from 'drizzle-orm';
import { workflow } from '@server/database/schema';
import type {
  WorkflowConfig,
  WorkflowListResp,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
} from '@shared/api.interface';

@Injectable()
export class WorkflowService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getWorkflows(): Promise<WorkflowListResp> {
    const results = await this.db.select().from(workflow).orderBy(workflow.createdAt);
    return {
      items: results.map(this.mapToConfig),
      total: results.length,
    };
  }

  async getWorkflowById(id: string): Promise<WorkflowConfig | null> {
    const results = await this.db.select().from(workflow).where(eq(workflow.id, id));
    if (results.length === 0) return null;
    return this.mapToConfig(results[0]);
  }

  async createWorkflow(userId: string, dto: CreateWorkflowRequest): Promise<WorkflowConfig> {
    const result = await this.db
      .insert(workflow)
      .values({
        name: dto.name,
        description: dto.description || null,
        inputSchema: dto.inputSchema || [],
        outputSchema: dto.outputSchema || [],
        nodes: dto.nodes || [],
        edges: dto.edges || [],
        isActive: true,
      })
      .returning();
    return this.mapToConfig(result[0]);
  }

  async updateWorkflow(id: string, dto: UpdateWorkflowRequest): Promise<WorkflowConfig | null> {
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.inputSchema !== undefined) updateData.inputSchema = dto.inputSchema;
    if (dto.outputSchema !== undefined) updateData.outputSchema = dto.outputSchema;
    if (dto.nodes !== undefined) updateData.nodes = dto.nodes;
    if (dto.edges !== undefined) updateData.edges = dto.edges;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const result = await this.db
      .update(workflow)
      .set(updateData)
      .where(eq(workflow.id, id))
      .returning();
    if (result.length === 0) return null;
    return this.mapToConfig(result[0]);
  }

  async deleteWorkflow(id: string): Promise<{ success: boolean }> {
    await this.db.delete(workflow).where(eq(workflow.id, id));
    return { success: true };
  }

  private mapToConfig(row: Record<string, unknown>): WorkflowConfig {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      inputSchema: (row.inputSchema as WorkflowConfig['inputSchema']) || [],
      outputSchema: (row.outputSchema as WorkflowConfig['outputSchema']) || [],
      nodes: (row.nodes as WorkflowConfig['nodes']) || [],
      edges: (row.edges as WorkflowConfig['edges']) || [],
      isActive: row.isActive as boolean,
      createdAt: (row.createdAt as Date).toISOString(),
      updatedAt: (row.updatedAt as Date).toISOString(),
    };
  }
}
