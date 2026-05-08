import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ToolService } from './tool.service';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

// 文件类型定义
interface UploadedFileType {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Controller('api/tools')
export class ToolController {
  constructor(private readonly toolService: ToolService) {}

  @Get()
  async getTools(@Query('type') type?: string) {
    return this.toolService.getTools(type);
  }

  @Get(':id')
  async getTool(@Param('id') id: string) {
    return this.toolService.getTool(id);
  }

  @NeedLogin()
  @Post()
  async createTool(@Body() dto: CreateToolDto) {
    return this.toolService.createTool(dto);
  }

  @NeedLogin()
  @Put(':id')
  async updateTool(@Param('id') id: string, @Body() dto: UpdateToolDto) {
    return this.toolService.updateTool(id, dto);
  }

  @NeedLogin()
  @Delete(':id')
  async deleteTool(@Param('id') id: string) {
    return this.toolService.deleteTool(id);
  }

  @NeedLogin()
  @Post(':id/test')
  async testConnection(@Param('id') id: string) {
    return this.toolService.testConnection(id);
  }

  /**
   * 解析 Skill 文件（Markdown 或 Zip）
   * 接收 base64 编码的文件内容
   */
  @NeedLogin()
  @Post('parse-skill')
  async parseSkillFile(@Body() body: { fileName: string; content: string }) {
    return this.toolService.parseSkillFileFromBase64(body.fileName, body.content);
  }
}

interface CreateToolDto {
  name: string;
  type: 'mcp' | 'cloud_plugin' | 'skill';
  description?: string;
  configData?: Record<string, unknown>;
  skillData?: SkillDataDto;
}

interface UpdateToolDto {
  name?: string;
  description?: string;
  configData?: Record<string, unknown>;
  isActive?: boolean;
  skillData?: SkillDataDto;
}

interface SkillDataDto {
  name: string;
  description?: string;
  content: string;
  fileType: 'markdown' | 'zip';
  inputSchema?: Array<{ name: string; type: string; description: string; required?: boolean }>;
  outputSchema?: Array<{ name: string; type: string; description: string }>;
  examples?: Array<{ input: Record<string, unknown>; output: string }>;
  metadata?: { author?: string; tags?: string[]; category?: string };
  version?: string;
}
