import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { conversation, message } from '@server/database/schema';
import {
  eq,
  and,
  count,
  desc,
  asc,
  like,
  inArray,
  sql,
} from 'drizzle-orm';
import type {
  Conversation,
  ConversationListResp,
  Message,
  MessageContentItem,
  MessageListResp,
  CreateConversationRequest,
  BatchDeleteConversationsRequest,
  BatchDeleteResp,
} from '@shared/api.interface';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getConversations(
    userId: string,
    page: number,
    pageSize: number,
    keyword?: string,
  ): Promise<ConversationListResp> {
    try {
      const offset = (page - 1) * pageSize;

      const conditions = [eq(conversation.userId, userId)];
      if (keyword) {
        conditions.push(like(conversation.title, `%${keyword}%`));
      }

      const [listResult, totalResult] = await Promise.all([
        this.db
          .select()
          .from(conversation)
          .where(and(...conditions))
          .orderBy(desc(conversation.createdAt))
          .limit(pageSize)
          .offset(offset),
        this.db
          .select({ count: count() })
          .from(conversation)
          .where(and(...conditions)),
      ]);

      const items: Conversation[] = listResult.map((row) => ({
        id: row.id,
        title: row.title,
        model: row.model,
        messageCount: row.messageCount ?? 0,
        createdAt: row.createdAt instanceof Date 
          ? row.createdAt.toISOString() 
          : String(row.createdAt),
      }));

      return {
        items,
        total: totalResult[0]?.count ?? 0,
      };
    } catch (error) {
      this.logger.error(
        `获取会话列表失败: userId=${userId}, page=${page}, pageSize=${pageSize}, keyword=${keyword}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async getMessages(
    conversationId: string,
    page: number,
    pageSize: number,
  ): Promise<MessageListResp> {
    try {
      const offset = (page - 1) * pageSize;

      const [listResult, totalResult] = await Promise.all([
        this.db
          .select()
          .from(message)
          .where(eq(message.conversationId, conversationId))
          .orderBy(asc(message.createdAt))
          .limit(pageSize)
          .offset(offset),
        this.db
          .select({ count: count() })
          .from(message)
          .where(eq(message.conversationId, conversationId)),
      ]);

      const items: Message[] = listResult.map((row) => {
        // 解析多模态内容（JSON字符串转为数组）
        let parsedContent: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = row.content;
        if (typeof row.content === 'string' && row.content.startsWith('[{"type":')) {
          try {
            parsedContent = JSON.parse(row.content);
          } catch {
            // 解析失败则保持原样
          }
        }
        return {
          id: row.id,
          role: row.role as 'user' | 'assistant',
          content: parsedContent,
          tokenUsage: row.tokenUsage ?? 0,
          createdAt: row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : String(row.createdAt),
          mentions: row.mentions as Message['mentions'],
        };
      });

      return {
        items,
        total: totalResult[0]?.count ?? 0,
      };
    } catch (error) {
      this.logger.error(
        `获取消息列表失败: conversationId=${conversationId}, page=${page}, pageSize=${pageSize}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async createConversation(
    userId: string,
    dto: CreateConversationRequest,
  ): Promise<Conversation> {
    try {
      const [result] = await this.db
        .insert(conversation)
        .values({
          userId,
          title: dto.title,
          model: dto.model,
          messageCount: 0,
        })
        .returning();

      return {
        id: result.id,
        title: result.title,
        model: result.model,
        messageCount: result.messageCount ?? 0,
        createdAt: result.createdAt instanceof Date
          ? result.createdAt.toISOString()
          : String(result.createdAt),
      };
    } catch (error) {
      this.logger.error(
        `创建会话失败: userId=${userId}, title=${dto.title}, model=${dto.model}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async deleteConversation(conversationId: string): Promise<{ success: boolean }> {
    try {
      await this.db
        .delete(conversation)
        .where(eq(conversation.id, conversationId));

      return { success: true };
    } catch (error) {
      this.logger.error(
        `删除会话失败: conversationId=${conversationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async batchDeleteConversations(
    dto: BatchDeleteConversationsRequest,
  ): Promise<BatchDeleteResp> {
    try {
      const result = await this.db
        .delete(conversation)
        .where(inArray(conversation.id, dto.ids));

      return {
        success: true,
        deletedCount: dto.ids.length,
      };
    } catch (error) {
      this.logger.error(
        `批量删除会话失败: ids=${JSON.stringify(dto.ids)}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
