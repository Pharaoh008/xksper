import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { tokenUsage, conversation, agent, workflow, role, organization } from '@server/database/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import type {
  TokenOverviewResp,
  UsageRecordListResp,
  UsageRecord,
  GlobalTokenOverviewResp,
  UserTokenStat,
  ModelUsage,
  AgentTokenStat,
  WorkflowTokenStat,
  OrganizationTokenStat,
  RoleTokenStat,
} from '@shared/api.interface';

@Injectable()
export class TokenMonitorService {
  private readonly logger = new Logger(TokenMonitorService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  /**
   * 获取全局Token概览（管理员用）
   */
  async getGlobalOverview(
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalTokenOverviewResp> {
    try {
      const conditions = [];

      if (startDate) {
        conditions.push(gte(tokenUsage.createdAt, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(tokenUsage.createdAt, new Date(endDate)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const totalResult = await this.db
        .select({
          totalTokens: sql<number>`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`,
          totalCost: sql<number>`COALESCE(SUM(${tokenUsage.cost}), 0)`,
          totalCalls: sql<number>`COUNT(*)`,
          totalUsers: sql<number>`COUNT(DISTINCT ${tokenUsage.userId})`,
        })
        .from(tokenUsage)
        .where(whereClause);

      const totalTokens = Number(totalResult[0]?.totalTokens ?? 0);
      const totalCost = Number(totalResult[0]?.totalCost ?? 0);
      const totalCalls = Number(totalResult[0]?.totalCalls ?? 0);
      const totalUsers = Number(totalResult[0]?.totalUsers ?? 0);

      const userStatsResult = await this.db
        .select({
          userId: tokenUsage.userId,
          totalTokens: sql<number>`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`,
          totalCost: sql<number>`COALESCE(SUM(${tokenUsage.cost}), 0)`,
          callCount: sql<number>`COUNT(*)`,
        })
        .from(tokenUsage)
        .where(whereClause)
        .groupBy(tokenUsage.userId)
        .orderBy(desc(sql`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`));

      const userStats: UserTokenStat[] = userStatsResult.map((row) => ({
        userId: row.userId,
        totalTokens: Number(row.totalTokens),
        totalCost: Number(row.totalCost),
        callCount: Number(row.callCount),
      }));

      const modelStats = await this.db
        .select({
          model: tokenUsage.model,
          tokens: sql<number>`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`,
          cost: sql<number>`COALESCE(SUM(${tokenUsage.cost}), 0)`,
        })
        .from(tokenUsage)
        .where(whereClause)
        .groupBy(tokenUsage.model);

      const modelUsage: ModelUsage[] = modelStats.map((row) => ({
        model: row.model,
        tokens: Number(row.tokens),
        cost: Number(row.cost),
        percentage: totalTokens > 0 ? Math.round((Number(row.tokens) / totalTokens) * 10000) / 100 : 0,
      }));

      // Agent维度统计
      const agentStatsResult = await this.db
        .select({
          agentId: tokenUsage.agentId,
          totalTokens: sql<number>`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`,
          totalCost: sql<number>`COALESCE(SUM(${tokenUsage.cost}), 0)`,
          callCount: sql<number>`COUNT(*)`,
        })
        .from(tokenUsage)
        .where(whereClause)
        .groupBy(tokenUsage.agentId)
        .orderBy(desc(sql`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`));

      const agentIds = agentStatsResult.map((r) => r.agentId).filter((id): id is string => id !== null);
      const agentMap = new Map<string, string>();
      if (agentIds.length > 0) {
        const agents = await this.db
          .select({ id: agent.id, name: agent.name })
          .from(agent)
          .where(sql`${agent.id} = ANY(${agentIds})`);
        agents.forEach((a) => agentMap.set(a.id, a.name));
      }

      const agentStats: AgentTokenStat[] = agentStatsResult.map((row) => ({
        agentId: row.agentId,
        agentName: row.agentId ? agentMap.get(row.agentId) ?? null : null,
        totalTokens: Number(row.totalTokens),
        totalCost: Number(row.totalCost),
        callCount: Number(row.callCount),
      }));

      // Workflow维度统计
      const workflowStatsResult = await this.db
        .select({
          workflowId: tokenUsage.workflowId,
          totalTokens: sql<number>`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`,
          totalCost: sql<number>`COALESCE(SUM(${tokenUsage.cost}), 0)`,
          callCount: sql<number>`COUNT(*)`,
        })
        .from(tokenUsage)
        .where(whereClause)
        .groupBy(tokenUsage.workflowId)
        .orderBy(desc(sql`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`));

      const workflowIds = workflowStatsResult.map((r) => r.workflowId).filter((id): id is string => id !== null);
      const workflowMap = new Map<string, string>();
      if (workflowIds.length > 0) {
        const workflows = await this.db
          .select({ id: workflow.id, name: workflow.name })
          .from(workflow)
          .where(sql`${workflow.id} = ANY(${workflowIds})`);
        workflows.forEach((w) => workflowMap.set(w.id, w.name));
      }

      const workflowStats: WorkflowTokenStat[] = workflowStatsResult.map((row) => ({
        workflowId: row.workflowId,
        workflowName: row.workflowId ? workflowMap.get(row.workflowId) ?? null : null,
        totalTokens: Number(row.totalTokens),
        totalCost: Number(row.totalCost),
        callCount: Number(row.callCount),
      }));

      // 组织维度统计（通过role表关联user与organization）
      const orgStatsResult = await this.db
        .select({
          organizationId: role.organizationId,
          totalTokens: sql<number>`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`,
          totalCost: sql<number>`COALESCE(SUM(${tokenUsage.cost}), 0)`,
          userCount: sql<number>`COUNT(DISTINCT ${tokenUsage.userId})`,
        })
        .from(tokenUsage)
        .leftJoin(role, eq(tokenUsage.userId, role.userName))
        .where(whereClause)
        .groupBy(role.organizationId)
        .orderBy(desc(sql`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`));

      const orgIds = orgStatsResult.map((r) => r.organizationId).filter((id): id is string => id !== null);
      const orgMap = new Map<string, string>();
      if (orgIds.length > 0) {
        const orgs = await this.db
          .select({ id: organization.id, name: organization.name })
          .from(organization)
          .where(sql`${organization.id} = ANY(${orgIds})`);
        orgs.forEach((o) => orgMap.set(o.id, o.name));
      }

      const organizationStats: OrganizationTokenStat[] = orgStatsResult.map((row) => ({
        orgId: row.organizationId,
        orgName: row.organizationId ? orgMap.get(row.organizationId) ?? null : null,
        totalTokens: Number(row.totalTokens),
        totalCost: Number(row.totalCost),
        userCount: Number(row.userCount),
      }));

      // 角色维度统计
      const roleStatsResult = await this.db
        .select({
          roleId: role.id,
          roleName: role.name,
          totalTokens: sql<number>`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`,
          totalCost: sql<number>`COALESCE(SUM(${tokenUsage.cost}), 0)`,
          userCount: sql<number>`COUNT(DISTINCT ${tokenUsage.userId})`,
        })
        .from(tokenUsage)
        .leftJoin(role, eq(tokenUsage.userId, role.userName))
        .where(whereClause)
        .groupBy(role.id, role.name)
        .orderBy(desc(sql`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`));

      const roleStats: RoleTokenStat[] = roleStatsResult.map((row) => ({
        roleId: row.roleId,
        roleName: row.roleName,
        totalTokens: Number(row.totalTokens),
        totalCost: Number(row.totalCost),
        userCount: Number(row.userCount),
      }));

      return {
        totalTokens,
        totalCost,
        totalUsers,
        totalCalls,
        userStats,
        modelUsage,
        agentStats,
        workflowStats,
        organizationStats,
        roleStats,
      };
    } catch (error) {
      this.logger.error('获取全局Token概览失败', JSON.stringify(error));
      throw error;
    }
  }

  async getOverview(
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<TokenOverviewResp> {
    try {
      const conditions = [eq(tokenUsage.userId, userId)];

      if (startDate) {
        conditions.push(gte(tokenUsage.createdAt, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(tokenUsage.createdAt, new Date(endDate)));
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      const totalResult = await this.db
        .select({
          totalTokens: sql<number>`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`,
          totalCost: sql<number>`COALESCE(SUM(${tokenUsage.cost}), 0)`,
        })
        .from(tokenUsage)
        .where(whereClause);

      const totalTokens = totalResult[0]?.totalTokens ?? 0;
      const totalCost = totalResult[0]?.totalCost ?? 0;

      const modelStats = await this.db
        .select({
          model: tokenUsage.model,
          tokens: sql<number>`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`,
          cost: sql<number>`COALESCE(SUM(${tokenUsage.cost}), 0)`,
        })
        .from(tokenUsage)
        .where(whereClause)
        .groupBy(tokenUsage.model);

      const modelUsage = modelStats.map((row) => ({
        model: row.model,
        tokens: Number(row.tokens),
        cost: Number(row.cost),
        percentage: totalTokens > 0 ? Math.round((Number(row.tokens) / totalTokens) * 10000) / 100 : 0,
      }));

      return { totalTokens, totalCost, modelUsage };
    } catch (error) {
      this.logger.error('获取Token使用概览失败', JSON.stringify(error));
      throw error;
    }
  }

  async getUsageList(
    userId: string,
    page: number,
    pageSize: number,
    startDate?: string,
    endDate?: string,
    model?: string,
  ): Promise<UsageRecordListResp> {
    try {
      const conditions = [eq(tokenUsage.userId, userId)];

      if (startDate) {
        conditions.push(gte(tokenUsage.createdAt, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(tokenUsage.createdAt, new Date(endDate)));
      }
      if (model) {
        conditions.push(eq(tokenUsage.model, model));
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      const offset = (page - 1) * pageSize;

      const records = await this.db
        .select({
          id: tokenUsage.id,
          userId: tokenUsage.userId,
          model: tokenUsage.model,
          promptTokens: tokenUsage.promptTokens,
          completionTokens: tokenUsage.completionTokens,
          totalTokens: tokenUsage.totalTokens,
          cost: tokenUsage.cost,
          createdAt: tokenUsage.createdAt,
          conversationId: tokenUsage.conversationId,
        })
        .from(tokenUsage)
        .where(whereClause)
        .orderBy(desc(tokenUsage.createdAt))
        .limit(pageSize)
        .offset(offset);

      const conversationIds = records
        .map((r) => r.conversationId)
        .filter((id): id is string => id !== null);

      const conversations =
        conversationIds.length > 0
          ? await this.db
              .select({ id: conversation.id, title: conversation.title })
              .from(conversation)
              .where(sql`${conversation.id} = ANY(${conversationIds})`)
          : [];

      const conversationMap = new Map(conversations.map((c) => [c.id, c.title]));

      const items: UsageRecord[] = records.map((record) => ({
        id: record.id,
        userId: record.userId,
        model: record.model,
        promptTokens: Number(record.promptTokens ?? 0),
        completionTokens: Number(record.completionTokens ?? 0),
        totalTokens: Number(record.totalTokens),
        cost: Number(record.cost),
        createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
        conversationTitle: record.conversationId
          ? conversationMap.get(record.conversationId) ?? undefined
          : undefined,
      }));

      const countResult = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(tokenUsage)
        .where(whereClause);

      const total = Number(countResult[0]?.count ?? 0);

      return { items, total };
    } catch (error) {
      this.logger.error('获取消费记录列表失败', JSON.stringify(error));
      throw error;
    }
  }
}
