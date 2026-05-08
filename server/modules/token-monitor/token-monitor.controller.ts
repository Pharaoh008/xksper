import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin, CanRole } from '@lark-apaas/fullstack-nestjs-core';
import { TokenMonitorService } from './token-monitor.service';
import type { TokenOverviewResp, UsageRecordListResp, GlobalTokenOverviewResp } from '@shared/api.interface';

@Controller('api/token-usage')
export class TokenMonitorController {
  constructor(private readonly tokenMonitorService: TokenMonitorService) {}

  /**
   * 获取全局Token概览（仅管理员）
   */
  @NeedLogin()
  @CanRole(['admin'])
  @Get('global')
  async getGlobalOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<GlobalTokenOverviewResp> {
    return this.tokenMonitorService.getGlobalOverview(startDate, endDate);
  }

  @NeedLogin()
  @Get('overview')
  async getOverview(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TokenOverviewResp> {
    const { userId } = req.userContext;
    return this.tokenMonitorService.getOverview(userId, startDate, endDate);
  }

  @NeedLogin()
  @Get('list')
  async getUsageList(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('model') model?: string,
  ): Promise<UsageRecordListResp> {
    const { userId } = req.userContext;
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    return this.tokenMonitorService.getUsageList(
      userId,
      pageNum,
      pageSizeNum,
      startDate,
      endDate,
      model,
    );
  }
}
