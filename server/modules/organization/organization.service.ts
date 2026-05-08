import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import {
  organization,
  organizationHierarchy,
  organizationResourcePermission,
  role,
} from '../../database/schema';
import type {
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationResourcePermission,
  GrantResourcePermissionRequest,
  Role,
  PermissionType,
} from '@shared/api.interface';

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async findAll(): Promise<Organization[]> {
    const orgs = await this.db.select().from(organization);
    return orgs.map((org) => this.mapToOrganization(org));
  }

  async findById(id: string): Promise<Organization> {
    const [org] = await this.db
      .select()
      .from(organization)
      .where(eq(organization.id, id));
    if (!org) {
      throw new NotFoundException('组织不存在');
    }
    return this.mapToOrganization(org);
  }

  async create(dto: CreateOrganizationRequest): Promise<Organization> {
    // 创建组织
    const [org] = await this.db
      .insert(organization)
      .values({
        name: dto.name,
        description: dto.description,
      })
      .returning();

    // 自动创建管理层和普通层
    await this.db.insert(organizationHierarchy).values([
      { organizationId: org.id, levelType: 'management' },
      { organizationId: org.id, levelType: 'normal' },
    ]);

    return this.mapToOrganization(org);
  }

  async update(id: string, dto: UpdateOrganizationRequest): Promise<Organization> {
    const [org] = await this.db
      .update(organization)
      .set({
        name: dto.name,
        description: dto.description,
        updatedAt: new Date(),
      })
      .where(eq(organization.id, id))
      .returning();

    if (!org) {
      throw new NotFoundException('组织不存在');
    }

    return this.mapToOrganization(org);
  }

  async delete(id: string): Promise<void> {
    // 检查组织下是否有角色
    const [existingRole] = await this.db
      .select()
      .from(role)
      .where(eq(role.organizationId, id));

    if (existingRole) {
      throw new Error('该组织下存在角色，无法删除');
    }

    await this.db.delete(organization).where(eq(organization.id, id));
  }

  // 资源授权相关
  async getResourcePermissions(
    orgId: string,
  ): Promise<OrganizationResourcePermission[]> {
    const perms = await this.db
      .select()
      .from(organizationResourcePermission)
      .where(eq(organizationResourcePermission.organizationId, orgId));

    return perms.map((p) => this.mapToResourcePermission(p));
  }

  async grantResourcePermission(
    orgId: string,
    dto: GrantResourcePermissionRequest,
  ): Promise<OrganizationResourcePermission> {
    // 先查询是否已存在
    const existing = await this.db
      .select()
      .from(organizationResourcePermission)
      .where(
        and(
          eq(organizationResourcePermission.organizationId, orgId),
          eq(organizationResourcePermission.levelType, dto.levelType),
          eq(organizationResourcePermission.resourceType, dto.resourceType),
          eq(organizationResourcePermission.resourceId, dto.resourceId),
        ),
      )
      .limit(1);

    // 如果已存在，直接返回
    if (existing.length > 0) {
      return this.mapToResourcePermission(existing[0]);
    }

    // 不存在则插入
    const [result] = await this.db
      .insert(organizationResourcePermission)
      .values({
        organizationId: orgId,
        levelType: dto.levelType,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
      })
      .returning();

    return this.mapToResourcePermission(result);
  }

  async revokeResourcePermission(permissionId: string): Promise<void> {
    await this.db
      .delete(organizationResourcePermission)
      .where(eq(organizationResourcePermission.id, permissionId));
  }

  // 根据资源查找有权访问的组织
  async findByResource(
    resourceType: string,
    resourceId: string,
  ): Promise<Organization[]> {
    const rows = await this.db
      .select({
        org: organization,
      })
      .from(organizationResourcePermission)
      .innerJoin(
        organization,
        eq(organizationResourcePermission.organizationId, organization.id),
      )
      .where(
        and(
          eq(organizationResourcePermission.resourceType, resourceType),
          eq(organizationResourcePermission.resourceId, resourceId),
        ),
      );

    return rows.map((r) => this.mapToOrganization(r.org));
  }

  // 获取组织下的角色
  async getOrganizationRoles(orgId: string): Promise<Role[]> {
    const roles = await this.db
      .select()
      .from(role)
      .where(eq(role.organizationId, orgId));

    return roles.map((r) => this.mapToRole(r));
  }

  // 检查角色是否有权限访问资源
  async checkPermission(
    orgId: string | null,
    levelType: string | null,
    resourceType: string,
    resourceId: string,
  ): Promise<boolean> {
    if (!orgId) return true; // 没有组织的角色可以访问所有资源

    // 查找该组织对该资源的授权
    const perms = await this.db
      .select()
      .from(organizationResourcePermission)
      .where(
        and(
          eq(organizationResourcePermission.organizationId, orgId),
          eq(organizationResourcePermission.resourceType, resourceType),
          eq(organizationResourcePermission.resourceId, resourceId),
        ),
      );

    if (perms.length === 0) return false;

    // 检查层级权限
    for (const perm of perms) {
      if (perm.levelType === 'all') return true;
      if (perm.levelType === levelType) return true;
    }

    return false;
  }

  // 获取角色可访问的资源ID列表
  async getAccessibleResources(
    orgId: string | null,
    levelType: string | null,
    resourceType: string,
  ): Promise<string[]> {
    if (!orgId) return []; // 返回空数组表示可以访问全部

    const perms = await this.db
      .select({ resourceId: organizationResourcePermission.resourceId })
      .from(organizationResourcePermission)
      .where(
        and(
          eq(organizationResourcePermission.organizationId, orgId),
          eq(organizationResourcePermission.resourceType, resourceType),
          inArray(organizationResourcePermission.levelType, [
            'all',
            levelType || 'normal',
          ]),
        ),
      );

    return perms.map((p) => p.resourceId);
  }

  private mapToOrganization(org: typeof organization.$inferSelect): Organization {
    return {
      id: org.id,
      name: org.name,
      description: org.description || undefined,
      createdAt: org.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: org.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  private mapToResourcePermission(
    perm: typeof organizationResourcePermission.$inferSelect,
  ): OrganizationResourcePermission {
    return {
      id: perm.id,
      organizationId: perm.organizationId,
      levelType: perm.levelType as 'management' | 'normal' | 'all',
      resourceType: perm.resourceType as PermissionType,
      resourceId: perm.resourceId,
      createdAt: perm.createdAt?.toISOString() || new Date().toISOString(),
    };
  }

  private mapToRole(r: typeof role.$inferSelect): Role {
    return {
      id: r.id,
      name: r.name,
      description: r.description || undefined,
      userName: r.userName || undefined,
      phone: r.phone || undefined,
      department: r.department || undefined,
      organizationId: r.organizationId || undefined,
      levelType: (r.levelType as 'management' | 'normal') || undefined,
      permissions: [],
      createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: r.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
