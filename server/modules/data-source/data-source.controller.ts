import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { DataSourceService } from './data-source.service';

interface CreateDataSourceDto {
  name: string;
  baseToken: string;
  tableId: string;
  viewId?: string;
  description?: string;
}

interface UpdateDataSourceDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

@Controller('api/data-sources')
export class DataSourceController {
  constructor(private readonly dataSourceService: DataSourceService) {}

  @Get()
  async findAll() {
    return this.dataSourceService.findAll();
  }

  @Get('active')
  async findActive() {
    return this.dataSourceService.getAllActiveDataSources();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.dataSourceService.findById(id);
  }

  @NeedLogin()
  @Post()
  async create(
    @Body() dto: CreateDataSourceDto,
    @Req() req: Request,
  ) {
    return this.dataSourceService.create(dto, req.userContext.userId);
  }

  @NeedLogin()
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDataSourceDto,
  ) {
    return this.dataSourceService.update(id, dto);
  }

  @NeedLogin()
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.dataSourceService.delete(id);
    return { success: true };
  }

  @NeedLogin()
  @Post(':id/sync')
  async sync(@Param('id') id: string) {
    return this.dataSourceService.syncData(id);
  }

  @Get(':id/data')
  async getData(
    @Param('id') id: string,
    @Query('search') search?: string,
  ) {
    return this.dataSourceService.getSyncedData(id, search);
  }

  @Get(':id/data/:recordId')
  async getDataById(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
  ) {
    return this.dataSourceService.getSyncedDataById(id, recordId);
  }
}
