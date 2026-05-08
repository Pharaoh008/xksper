import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type {
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationResourcePermission,
  GrantResourcePermissionRequest,
  Role,
} from '@shared/api.interface';

@Controller('api/organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  async getOrganizations(): Promise<{ items: Organization[] }> {
    const items = await this.organizationService.findAll();
    return { items };
  }

  @Get(':id')
  async getOrganization(@Param('id') id: string): Promise<Organization> {
    return this.organizationService.findById(id);
  }

  @NeedLogin()
  @Post()
  async createOrganization(
    @Body() dto: CreateOrganizationRequest,
  ): Promise<Organization> {
    return this.organizationService.create(dto);
  }

  @NeedLogin()
  @Put(':id')
  async updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationRequest,
  ): Promise<Organization> {
    return this.organizationService.update(id, dto);
  }

  @NeedLogin()
  @Delete(':id')
  async deleteOrganization(@Param('id') id: string): Promise<void> {
    return this.organizationService.delete(id);
  }

  // 资源授权相关接口
  @Get(':id/permissions')
  async getResourcePermissions(
    @Param('id') id: string,
  ): Promise<{ items: OrganizationResourcePermission[] }> {
    const items = await this.organizationService.getResourcePermissions(id);
    return { items };
  }

  @NeedLogin()
  @Post(':id/permissions')
  async grantResourcePermission(
    @Param('id') id: string,
    @Body() dto: GrantResourcePermissionRequest,
  ): Promise<OrganizationResourcePermission> {
    return this.organizationService.grantResourcePermission(id, dto);
  }

  @NeedLogin()
  @Delete(':id/permissions/:permissionId')
  async revokeResourcePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ): Promise<void> {
    return this.organizationService.revokeResourcePermission(permissionId);
  }

  // 根据资源获取有权访问的组织列表（用于授权界面）
  @Get('resource/:type/:resourceId')
  async getOrganizationsByResource(
    @Param('type') type: string,
    @Param('resourceId') resourceId: string,
  ): Promise<{ items: Organization[] }> {
    const items = await this.organizationService.findByResource(type, resourceId);
    return { items };
  }

  // 获取组织下的角色
  @Get(':id/roles')
  async getOrganizationRoles(
    @Param('id') id: string,
  ): Promise<{ items: Role[] }> {
    const items = await this.organizationService.getOrganizationRoles(id);
    return { items };
  }
}
