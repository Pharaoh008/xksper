import { Controller, Get, Post, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { ConversationService } from './conversation.service';
import type { Request } from 'express';
import type {
  ConversationListResp,
  MessageListResp,
  Conversation,
  CreateConversationRequest,
  BatchDeleteConversationsRequest,
  BatchDeleteResp,
} from '@shared/api.interface';

@Controller('api/conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @NeedLogin()
  @Get()
  async getConversations(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ): Promise<ConversationListResp> {
    const { userId } = req.userContext;
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    return this.conversationService.getConversations(
      userId,
      pageNum,
      pageSizeNum,
      keyword,
    );
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<MessageListResp> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 50;

    return this.conversationService.getMessages(id, pageNum, pageSizeNum);
  }

  @NeedLogin()
  @Post()
  async createConversation(
    @Req() req: Request,
    @Body() dto: CreateConversationRequest,
  ): Promise<Conversation> {
    const { userId } = req.userContext;
    return this.conversationService.createConversation(userId, dto);
  }

  @NeedLogin()
  @Delete(':id')
  async deleteConversation(
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.conversationService.deleteConversation(id);
  }

  @NeedLogin()
  @Post('batch-delete')
  async batchDeleteConversations(
    @Body() dto: BatchDeleteConversationsRequest,
  ): Promise<BatchDeleteResp> {
    return this.conversationService.batchDeleteConversations(dto);
  }
}
