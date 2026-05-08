import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { knowledgeBase, knowledgeDocument, knowledgeFolder } from '../../database/schema';
import { eq, desc, and, isNull, count, sum } from 'drizzle-orm';
import type {
  KnowledgeBase,
  KnowledgeBaseListResp,
  KnowledgeDocumentListResp,
  CreateKnowledgeBaseRequest,
  UpdateKnowledgeBaseRequest,
  UploadDocumentRequest,
  KnowledgeFolderListResp,
  CreateFolderRequest,
  UpdateFolderRequest,
} from '@shared/api.interface';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getKnowledgeBases(): Promise<KnowledgeBaseListResp> {
    const items = await this.db
      .select()
      .from(knowledgeBase)
      .orderBy(desc(knowledgeBase.createdAt));

    return {
      items: await Promise.all(items.map(row => this.mapToKnowledgeBase(row))),
      total: items.length,
    };
  }

  async getKnowledgeBasesByOrganization(organizationId?: string): Promise<KnowledgeBaseListResp> {
    const query = organizationId
      ? this.db.select().from(knowledgeBase).where(eq(knowledgeBase.organizationId, organizationId))
      : this.db.select().from(knowledgeBase).where(isNull(knowledgeBase.organizationId));

    const items = await query.orderBy(desc(knowledgeBase.createdAt));

    return {
      items: await Promise.all(items.map(row => this.mapToKnowledgeBase(row))),
      total: items.length,
    };
  }

  async getKnowledgeBaseById(id: string): Promise<KnowledgeBase | null> {
    const result = await this.db
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, id))
      .limit(1);

    if (!result.length) return null;
    return this.mapToKnowledgeBase(result[0]);
  }

  async createKnowledgeBase(userId: string, dto: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> {
    const result = await this.db
      .insert(knowledgeBase)
      .values({
        name: dto.name,
        description: dto.description,
        type: dto.type || 'local',
        feishuToken: dto.feishuToken,
        feishuSpaceId: dto.feishuSpaceId,
        feishuNodeIds: dto.feishuNodeIds || [],
        organizationId: dto.organizationId,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return this.mapToKnowledgeBase(result[0]);
  }

  async updateKnowledgeBase(id: string, dto: UpdateKnowledgeBaseRequest): Promise<KnowledgeBase | null> {
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.feishuToken !== undefined) updateData.feishuToken = dto.feishuToken;
    if (dto.feishuSpaceId !== undefined) updateData.feishuSpaceId = dto.feishuSpaceId;
    if (dto.feishuNodeIds !== undefined) updateData.feishuNodeIds = dto.feishuNodeIds;
    if (dto.organizationId !== undefined) updateData.organizationId = dto.organizationId;

    const result = await this.db
      .update(knowledgeBase)
      .set(updateData)
      .where(eq(knowledgeBase.id, id))
      .returning();

    if (!result.length) return null;
    return this.mapToKnowledgeBase(result[0]);
  }

  async deleteKnowledgeBase(id: string): Promise<boolean> {
    await this.db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
    return true;
  }

  // Folder operations
  async getFolders(knowledgeBaseId: string, parentId?: string): Promise<KnowledgeFolderListResp> {
    let query;
    if (parentId === undefined) {
      // Get root level folders (parentId is null)
      query = this.db.select().from(knowledgeFolder).where(
        and(
          eq(knowledgeFolder.knowledgeBaseId, knowledgeBaseId),
          isNull(knowledgeFolder.parentId)
        )
      );
    } else {
      query = this.db.select().from(knowledgeFolder).where(
        and(
          eq(knowledgeFolder.knowledgeBaseId, knowledgeBaseId),
          eq(knowledgeFolder.parentId, parentId)
        )
      );
    }

    const items = await query.orderBy(knowledgeFolder.sortOrder);

    return {
      items: items.map(row => this.mapToKnowledgeFolder(row)),
      total: items.length,
    };
  }

  async createFolder(userId: string, dto: CreateFolderRequest) {
    const result = await this.db
      .insert(knowledgeFolder)
      .values({
        knowledgeBaseId: dto.knowledgeBaseId,
        parentId: dto.parentId,
        name: dto.name,
        type: dto.type || 'folder',
        sortOrder: dto.sortOrder || 0,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return this.mapToKnowledgeFolder(result[0]);
  }

  async updateFolder(id: string, dto: UpdateFolderRequest) {
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    const result = await this.db
      .update(knowledgeFolder)
      .set(updateData)
      .where(eq(knowledgeFolder.id, id))
      .returning();

    if (!result.length) return null;
    return this.mapToKnowledgeFolder(result[0]);
  }

  async deleteFolder(id: string): Promise<boolean> {
    await this.db.delete(knowledgeFolder).where(eq(knowledgeFolder.id, id));
    return true;
  }

  // Document operations
  async addDocument(
    userId: string,
    knowledgeBaseId: string,
    doc: UploadDocumentRequest,
  ): Promise<{ id: string }> {
    this.logger.log(`添加文档: ${doc.name}, content长度: ${doc.content?.length || 0}`);

    const hasContent = doc.content !== undefined && doc.content !== null && doc.content.length > 0;
    const tokenCount = hasContent ? Math.ceil(doc.content.length / 4) : 0;

    this.logger.log(`保存文档: hasContent=${hasContent}, tokenCount=${tokenCount}`);

    const result = await this.db
      .insert(knowledgeDocument)
      .values({
        knowledgeBaseId,
        folderId: doc.folderId,
        name: doc.name,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        fileType: doc.fileType,
        content: doc.content,
        status: hasContent ? 'completed' : 'pending',
        tokenCount,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    this.logger.log(`文档保存成功: ${result[0].id}, status: ${result[0].status}`);
    return { id: result[0].id };
  }

  async getDocuments(knowledgeBaseId: string, folderId?: string): Promise<KnowledgeDocumentListResp> {
    let query;
    if (folderId) {
      query = this.db.select().from(knowledgeDocument).where(
        and(
          eq(knowledgeDocument.knowledgeBaseId, knowledgeBaseId),
          eq(knowledgeDocument.folderId, folderId)
        )
      );
    } else {
      // Get documents in root (folderId is null)
      query = this.db.select().from(knowledgeDocument).where(
        and(
          eq(knowledgeDocument.knowledgeBaseId, knowledgeBaseId),
          isNull(knowledgeDocument.folderId)
        )
      );
    }

    const items = await query.orderBy(desc(knowledgeDocument.createdAt));

    return {
      items: items.map((item) => ({
        id: item.id,
        knowledgeBaseId: item.knowledgeBaseId,
        folderId: item.folderId || undefined,
        name: item.name,
        fileSize: Number(item.fileSize),
        fileType: item.fileType || undefined,
        status: item.status as 'pending' | 'processing' | 'completed' | 'error',
        errorMessage: item.errorMessage || undefined,
        tokenCount: item.tokenCount || 0,
        createdAt: (item.createdAt as Date).toISOString(),
      })),
      total: items.length,
    };
  }

  async deleteDocument(knowledgeBaseId: string, docId: string): Promise<boolean> {
    await this.db
      .delete(knowledgeDocument)
      .where(eq(knowledgeDocument.id, docId));
    return true;
  }

  private async mapToKnowledgeBase(row: Record<string, unknown>): Promise<KnowledgeBase> {
    // Count documents for this knowledge base
    const docCount = await this.db
      .select({ count: count() })
      .from(knowledgeDocument)
      .where(eq(knowledgeDocument.knowledgeBaseId, row.id as string));

    const totalTokens = await this.db
      .select({ sum: sum(knowledgeDocument.tokenCount) })
      .from(knowledgeDocument)
      .where(eq(knowledgeDocument.knowledgeBaseId, row.id as string));

    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      type: row.type as 'local' | 'feishu',
      feishuToken: row.feishuToken as string | undefined,
      feishuSpaceId: row.feishuSpaceId as string | undefined,
      feishuNodeIds: (row.feishuNodeIds as string[]) || [],
      organizationId: row.organizationId as string | undefined,
      documentCount: Number(docCount[0]?.count || 0),
      tokenCount: Number(totalTokens[0]?.sum || 0),
      createdAt: (row.createdAt as Date).toISOString(),
      updatedAt: (row.updatedAt as Date).toISOString(),
    } as KnowledgeBase;
  }

  private mapToKnowledgeFolder(row: Record<string, unknown>) {
    return {
      id: row.id as string,
      knowledgeBaseId: row.knowledgeBaseId as string,
      parentId: row.parentId as string | undefined,
      name: row.name as string,
      type: row.type as 'folder' | 'knowledge',
      sortOrder: (row.sortOrder as number) || 0,
      createdAt: (row.createdAt as Date).toISOString(),
    };
  }
}
