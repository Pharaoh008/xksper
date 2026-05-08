import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { taskExecution, subTask } from '@server/database/schema';
import { eq, desc } from 'drizzle-orm';
import type { TaskPlan, SubTask } from './agent-graph.service';

export interface TaskExecutionRecord {
  id: string;
  agentId: string;
  userId: string;
  userQuery: string;
  status: 'running' | 'completed' | 'failed';
  plan?: TaskPlan;
  result?: string;
  tokenUsage: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubTaskRecord {
  id: string;
  executionId: string;
  taskId: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  toolCalls?: unknown;
  startedAt?: string;
  completedAt?: string;
}

@Injectable()
export class TaskExecutionService {
  private readonly logger = new Logger(TaskExecutionService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  /**
   * 创建任务执行记录
   */
  async createExecution(
    agentId: string,
    userId: string,
    userQuery: string,
    plan: TaskPlan,
  ): Promise<string> {
    try {
      const result = await this.db
        .insert(taskExecution)
        .values({
          agentId,
          userId,
          userQuery,
          status: 'running',
          plan: plan as unknown as Record<string, unknown>,
        })
        .returning({ id: taskExecution.id });

      const executionId = result[0].id;

      // 创建子任务记录
      for (const task of plan.tasks) {
        await this.db.insert(subTask).values({
          executionId,
          taskId: task.id,
          description: task.description,
          status: 'pending',
        });
      }

      this.logger.log(`创建任务执行记录: ${executionId}`);
      return executionId;
    } catch (error) {
      this.logger.error('创建任务执行记录失败', error);
      throw error;
    }
  }

  /**
   * 更新子任务状态为运行中
   */
  async startSubTask(executionId: string, taskId: string): Promise<void> {
    try {
      await this.db
        .update(subTask)
        .set({
          status: 'running',
          startedAt: new Date(),
        })
        .where(eq(subTask.executionId, executionId));

      this.logger.log(`子任务开始: ${taskId}`);
    } catch (error) {
      this.logger.error('更新子任务状态失败', error);
    }
  }

  /**
   * 完成子任务
   */
  async completeSubTask(
    executionId: string,
    taskId: string,
    result: string,
    toolCalls?: unknown,
  ): Promise<void> {
    try {
      await this.db
        .update(subTask)
        .set({
          status: 'completed',
          result,
          toolCalls: toolCalls as Record<string, unknown> | undefined,
          completedAt: new Date(),
        })
        .where(eq(subTask.executionId, executionId));

      this.logger.log(`子任务完成: ${taskId}`);
    } catch (error) {
      this.logger.error('更新子任务状态失败', error);
    }
  }

  /**
   * 标记子任务失败
   */
  async failSubTask(executionId: string, taskId: string, error: string): Promise<void> {
    try {
      await this.db
        .update(subTask)
        .set({
          status: 'failed',
          result: error,
          completedAt: new Date(),
        })
        .where(eq(subTask.executionId, executionId));

      this.logger.log(`子任务失败: ${taskId}`);
    } catch (err) {
      this.logger.error('更新子任务状态失败', err);
    }
  }

  /**
   * 完成任务执行
   */
  async completeExecution(
    executionId: string,
    result: string,
    tokenUsage: number,
  ): Promise<void> {
    try {
      await this.db
        .update(taskExecution)
        .set({
          status: 'completed',
          result,
          tokenUsage,
          updatedAt: new Date(),
        })
        .where(eq(taskExecution.id, executionId));

      this.logger.log(`任务执行完成: ${executionId}`);
    } catch (error) {
      this.logger.error('更新任务执行状态失败', error);
    }
  }

  /**
   * 更新任务计划
   */
  async updatePlan(executionId: string, plan: TaskPlan): Promise<void> {
    try {
      await this.db
        .update(taskExecution)
        .set({
          plan: plan as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(taskExecution.id, executionId));

      this.logger.log(`更新任务计划: ${executionId}`);
    } catch (error) {
      this.logger.error('更新任务计划失败', error);
    }
  }

  /**
   * 标记任务执行失败
   */
  async failExecution(executionId: string, error: string): Promise<void> {
    try {
      await this.db
        .update(taskExecution)
        .set({
          status: 'failed',
          result: error,
          updatedAt: new Date(),
        })
        .where(eq(taskExecution.id, executionId));

      this.logger.log(`任务执行失败: ${executionId}`);
    } catch (err) {
      this.logger.error('更新任务执行状态失败', err);
    }
  }

  /**
   * 获取任务执行详情
   */
  async getExecution(executionId: string): Promise<TaskExecutionRecord | null> {
    try {
      const result = await this.db
        .select()
        .from(taskExecution)
        .where(eq(taskExecution.id, executionId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const r = result[0];
      return {
        id: r.id,
        agentId: r.agentId,
        userId: r.userId,
        userQuery: r.userQuery,
        status: r.status as 'running' | 'completed' | 'failed',
        plan: r.plan as unknown as TaskPlan | undefined,
        result: r.result ?? undefined,
        tokenUsage: r.tokenUsage ?? 0,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
      };
    } catch (error) {
      this.logger.error('获取任务执行记录失败', error);
      return null;
    }
  }

  /**
   * 获取子任务列表
   */
  async getSubTasks(executionId: string): Promise<SubTaskRecord[]> {
    try {
      const result = await this.db
        .select()
        .from(subTask)
        .where(eq(subTask.executionId, executionId))
        .orderBy(subTask.createdAt);

      return result.map((r) => ({
        id: r.id,
        executionId: r.executionId,
        taskId: r.taskId,
        description: r.description,
        status: r.status as 'pending' | 'running' | 'completed' | 'failed',
        result: r.result ?? undefined,
        toolCalls: r.toolCalls ?? undefined,
        startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : undefined,
        completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : undefined,
      }));
    } catch (error) {
      this.logger.error('获取子任务列表失败', error);
      return [];
    }
  }

  /**
   * 获取 Agent 的任务执行历史
   */
  async getExecutionHistory(
    agentId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ items: TaskExecutionRecord[]; total: number }> {
    try {
      const records = await this.db
        .select()
        .from(taskExecution)
        .where(eq(taskExecution.agentId, agentId))
        .orderBy(desc(taskExecution.createdAt))
        .limit(limit)
        .offset(offset);

      const items: TaskExecutionRecord[] = records.map((r) => ({
        id: r.id,
        agentId: r.agentId,
        userId: r.userId,
        userQuery: r.userQuery,
        status: r.status as 'running' | 'completed' | 'failed',
        plan: r.plan as unknown as TaskPlan | undefined,
        result: r.result ?? undefined,
        tokenUsage: r.tokenUsage ?? 0,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
      }));

      return { items, total: items.length };
    } catch (error) {
      this.logger.error('获取任务执行历史失败', error);
      return { items: [], total: 0 };
    }
  }

  /**
   * 获取用户的任务执行历史
   */
  async getUserExecutionHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ items: TaskExecutionRecord[]; total: number }> {
    try {
      const records = await this.db
        .select()
        .from(taskExecution)
        .where(eq(taskExecution.userId, userId))
        .orderBy(desc(taskExecution.createdAt))
        .limit(limit)
        .offset(offset);

      const items: TaskExecutionRecord[] = records.map((r) => ({
        id: r.id,
        agentId: r.agentId,
        userId: r.userId,
        userQuery: r.userQuery,
        status: r.status as 'running' | 'completed' | 'failed',
        plan: r.plan as unknown as TaskPlan | undefined,
        result: r.result ?? undefined,
        tokenUsage: r.tokenUsage ?? 0,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
      }));

      return { items, total: items.length };
    } catch (error) {
      this.logger.error('获取用户任务执行历史失败', error);
      return { items: [], total: 0 };
    }
  }
}
