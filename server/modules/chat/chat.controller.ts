import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { ChatService } from './chat.service';
import type { ModelListResp, ChatRequest, ChatResp } from '@shared/api.interface';

@Controller('api')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * 获取可用模型列表
   */
  @Get('models')
  async getModels(): Promise<ModelListResp> {
    return this.chatService.getModels();
  }

  /**
   * 发送对话请求
   */
  @NeedLogin()
  @Post('chat/completions')
  async sendChat(
    @Req() req: Request,
    @Body() dto: ChatRequest,
  ): Promise<ChatResp> {
    const { userId } = req.userContext;
    return this.chatService.sendChat(userId, dto);
  }
}
