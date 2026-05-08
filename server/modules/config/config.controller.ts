import { Controller, Get, Post, Delete, Body, Req, Param } from '@nestjs/common';
import { NeedLogin, CanRole } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { ConfigService } from './config.service';
import type { SaveConfigRequest, ConfigStatusResp, SaveConfigResp, ValidateConfigResp, CustomModel, CreateCustomModelRequest } from '@shared/api.interface';

@Controller('api/config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取当前用户API配置
   */
  @NeedLogin()
  @Get()
  async getConfig(@Req() req: Request): Promise<ConfigStatusResp> {
    const { userId } = req.userContext;
    return this.configService.getConfigStatus(userId);
  }

  /**
   * 保存API配置 - 仅管理员可操作
   */
  @NeedLogin()
  @CanRole(['admin'])
  @Post()
  async saveConfig(
    @Req() req: Request,
    @Body() request: SaveConfigRequest,
  ): Promise<SaveConfigResp> {
    const { userId } = req.userContext;
    return this.configService.saveConfig(userId, request);
  }

  /**
   * 验证配置有效性
   */
  @NeedLogin()
  @CanRole(['admin'])
  @Post('validate')
  async validateConfig(@Body() request: SaveConfigRequest): Promise<ValidateConfigResp> {
    return this.configService.validateConfigOnly(request);
  }

  /**
   * 获取自定义模型列表
   */
  @NeedLogin()
  @Get('custom-models')
  async getCustomModels(@Req() req: Request): Promise<CustomModel[]> {
    const { userId } = req.userContext;
    return this.configService.getCustomModels(userId);
  }

  /**
   * 创建自定义模型
   */
  @NeedLogin()
  @CanRole(['admin'])
  @Post('custom-models')
  async createCustomModel(
    @Req() req: Request,
    @Body() request: CreateCustomModelRequest,
  ): Promise<CustomModel> {
    const { userId } = req.userContext;
    return this.configService.createCustomModel(userId, request);
  }

  /**
   * 删除自定义模型
   */
  @NeedLogin()
  @CanRole(['admin'])
  @Delete('custom-models/:modelId')
  async deleteCustomModel(
    @Req() req: Request,
    @Param('modelId') modelId: string,
  ): Promise<{ success: boolean }> {
    const { userId } = req.userContext;
    await this.configService.deleteCustomModel(userId, modelId);
    return { success: true };
  }
}
