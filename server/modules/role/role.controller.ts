import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { RoleService } from './role.service';
import type {
  RoleListResp,
  CreateRoleRequest,
  UpdateRoleRequest,
  Role,
} from '@shared/api.interface';

@Controller('api/role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async getRoles(): Promise<RoleListResp> {
    return this.roleService.getRoles();
  }

  @Get(':id')
  async getRoleById(@Param('id') id: string): Promise<Role> {
    const role = await this.roleService.getRoleById(id);
    if (!role) {
      throw new Error('角色不存在');
    }
    return role;
  }

  @NeedLogin()
  @Post()
  async createRole(
    @Req() req: Request,
    @Body() dto: CreateRoleRequest,
  ): Promise<Role> {
    return this.roleService.createRole(dto);
  }

  @NeedLogin()
  @Put(':id')
  async updateRole(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRoleRequest,
  ): Promise<Role> {
    const role = await this.roleService.updateRole(id, dto);
    if (!role) {
      throw new Error('角色不存在');
    }
    return role;
  }

  @NeedLogin()
  @Delete(':id')
  async deleteRole(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.roleService.deleteRole(id);
    return { success: true };
  }
}
