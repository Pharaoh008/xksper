import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { role, rolePermission, agent, workflow, tool, knowledgeBase } from '@server/database/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import type {
  Role,
  RoleListResp,
  CreateRoleRequest,
  UpdateRoleRequest,
  PermissionType,
  RolePermission,
} from '@shared/api.interface';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getRoles(): Promise<RoleListResp> {
    const roles = await this.db
      .select()
      .from(role)
      .orderBy(desc(role.createdAt));

    const roleIds = roles.map((r) => r.id);

    const permissions = roleIds.length > 0
      ? await this.db
          .select()
          .from(rolePermission)
          .where(inArray(rolePermission.roleId, roleIds))
      : [];

    const items: Role[] = await Promise.all(
      roles.map(async (r) => ({
        id: r.id,
        name: r.name,
        description: r.description || undefined,
        userName: r.userName || undefined,
        phone: r.phone || undefined,
        department: r.department || undefined,
        organizationId: r.organizationId || undefined,
        levelType: (r.levelType as 'management' | 'normal') || undefined,
        permissions: await this.mapPermissions(
          permissions.filter((p) => p.roleId === r.id),
        ),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );

    return { items, total: items.length };
  }

  private async mapPermissions(
    permissions: typeof rolePermission.$inferSelect[],
  ): Promise<RolePermission[]> {
    if (permissions.length === 0) return [];

    const agentIds = permissions
      .filter((p) => p.permissionType === 'agent')
      .map((p) => p.permissionId);
    const workflowIds = permissions
      .filter((p) => p.permissionType === 'workflow')
      .map((p) => p.permissionId);
    const toolIds = permissions
      .filter((p) => p.permissionType === 'tool')
      .map((p) => p.permissionId);
    const knowledgeIds = permissions
      .filter((p) => p.permissionType === 'knowledge')
      .map((p) => p.permissionId);

    const [
      agentNames,
      workflowNames,
      toolNames,
      knowledgeNames,
    ] = await Promise.all([
      agentIds.length > 0
        ? this.db.select({ id: agent.id, name: agent.name }).from(agent).where(inArray(agent.id, agentIds))
        : Promise.resolve([]),
      workflowIds.length > 0
        ? this.db.select({ id: workflow.id, name: workflow.name }).from(workflow).where(inArray(workflow.id, workflowIds))
        : Promise.resolve([]),
      toolIds.length > 0
        ? this.db.select({ id: tool.id, name: tool.name }).from(tool).where(inArray(tool.id, toolIds))
        : Promise.resolve([]),
      knowledgeIds.length > 0
        ? this.db.select({ id: knowledgeBase.id, name: knowledgeBase.name }).from(knowledgeBase).where(inArray(knowledgeBase.id, knowledgeIds))
        : Promise.resolve([]),
    ]);

    const nameMap = new Map<string, string>();
    agentNames.forEach((a) => nameMap.set(`agent:${a.id}`, a.name));
    workflowNames.forEach((w) => nameMap.set(`workflow:${w.id}`, w.name));
    toolNames.forEach((t) => nameMap.set(`tool:${t.id}`, t.name));
    knowledgeNames.forEach((k) => nameMap.set(`knowledge:${k.id}`, k.name));

    return permissions.map((p) => ({
      id: p.id,
      roleId: p.roleId,
      permissionType: p.permissionType as PermissionType,
      permissionId: p.permissionId,
      permissionName: nameMap.get(`${p.permissionType}:${p.permissionId}`),
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async getRoleById(id: string): Promise<Role | null> {
    const result = await this.db
      .select()
      .from(role)
      .where(eq(role.id, id))
      .limit(1);

    if (!result.length) return null;

    const r = result[0];
    const permissions = await this.db
      .select()
      .from(rolePermission)
      .where(eq(rolePermission.roleId, id));

    return {
      id: r.id,
      name: r.name,
      description: r.description || undefined,
      userName: r.userName || undefined,
      phone: r.phone || undefined,
      department: r.department || undefined,
      organizationId: r.organizationId || undefined,
      levelType: (r.levelType as 'management' | 'normal') || undefined,
      permissions: await this.mapPermissions(permissions),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async createRole(dto: CreateRoleRequest): Promise<Role> {
    const result = await this.db
      .insert(role)
      .values({
        name: dto.name,
        description: dto.description,
        userName: dto.userName,
        phone: dto.phone,
        department: dto.department,
        organizationId: dto.organizationId,
        levelType: dto.levelType,
      })
      .returning();

    const newRole = result[0];

    if (dto.permissions && dto.permissions.length > 0) {
      await this.db.insert(rolePermission).values(
        dto.permissions.map((p) => ({
          roleId: newRole.id,
          permissionType: p.permissionType,
          permissionId: p.permissionId,
        })),
      );
    }

    return this.getRoleById(newRole.id) as Promise<Role>;
  }

  async updateRole(id: string, dto: UpdateRoleRequest): Promise<Role | null> {
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.userName !== undefined) updateData.userName = dto.userName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.department !== undefined) updateData.department = dto.department;
    if (dto.organizationId !== undefined) updateData.organizationId = dto.organizationId;
    if (dto.levelType !== undefined) updateData.levelType = dto.levelType;

    const result = await this.db
      .update(role)
      .set(updateData)
      .where(eq(role.id, id))
      .returning();

    if (!result.length) return null;

    if (dto.permissions) {
      await this.db
        .delete(rolePermission)
        .where(eq(rolePermission.roleId, id));

      if (dto.permissions.length > 0) {
        await this.db.insert(rolePermission).values(
          dto.permissions.map((p) => ({
            roleId: id,
            permissionType: p.permissionType,
            permissionId: p.permissionId,
          })),
        );
      }
    }

    return this.getRoleById(id);
  }

  async deleteRole(id: string): Promise<boolean> {
    await this.db.delete(role).where(eq(role.id, id));
    return true;
  }
}
