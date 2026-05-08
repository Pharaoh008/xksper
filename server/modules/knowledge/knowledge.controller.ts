import { Controller, Get, Post, Put, Delete, Body, Param, Req, Query } from '@nestjs/common';
import { NeedLogin, CanRole } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { KnowledgeService } from './knowledge.service';
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

@Controller('api/knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  async getKnowledgeBases(
    @Query('organizationId') organizationId?: string,
  ): Promise<KnowledgeBaseListResp> {
    if (organizationId !== undefined) {
      return this.knowledgeService.getKnowledgeBasesByOrganization(organizationId);
    }
    return this.knowledgeService.getKnowledgeBases();
  }

  @Get(':id')
  async getKnowledgeBaseById(@Param('id') id: string): Promise<KnowledgeBase | null> {
    return this.knowledgeService.getKnowledgeBaseById(id);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Post()
  async createKnowledgeBase(
    @Req() req: Request,
    @Body() dto: CreateKnowledgeBaseRequest,
  ): Promise<KnowledgeBase> {
    const { userId } = req.userContext;
    return this.knowledgeService.createKnowledgeBase(userId, dto);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Put(':id')
  async updateKnowledgeBase(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeBaseRequest,
  ): Promise<KnowledgeBase | null> {
    return this.knowledgeService.updateKnowledgeBase(id, dto);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Delete(':id')
  async deleteKnowledgeBase(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.knowledgeService.deleteKnowledgeBase(id);
    return { success };
  }

  // Folder APIs
  @NeedLogin()
  @CanRole(['admin'])
  @Get(':id/folders')
  async getFolders(
    @Param('id') knowledgeBaseId: string,
    @Query('parentId') parentId?: string,
  ): Promise<KnowledgeFolderListResp> {
    return this.knowledgeService.getFolders(knowledgeBaseId, parentId);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Post(':id/folders')
  async createFolder(
    @Req() req: Request,
    @Param('id') knowledgeBaseId: string,
    @Body() dto: Omit<CreateFolderRequest, 'knowledgeBaseId'>,
  ) {
    const { userId } = req.userContext;
    return this.knowledgeService.createFolder(userId, { ...dto, knowledgeBaseId });
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Put('folders/:folderId')
  async updateFolder(
    @Param('folderId') folderId: string,
    @Body() dto: UpdateFolderRequest,
  ) {
    return this.knowledgeService.updateFolder(folderId, dto);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Delete('folders/:folderId')
  async deleteFolder(@Param('folderId') folderId: string): Promise<{ success: boolean }> {
    const success = await this.knowledgeService.deleteFolder(folderId);
    return { success };
  }

  // Document APIs
  @NeedLogin()
  @CanRole(['admin'])
  @Post(':id/documents')
  async uploadDocument(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UploadDocumentRequest,
  ): Promise<{ id: string }> {
    const { userId } = req.userContext;
    return this.knowledgeService.addDocument(userId, id, body);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Get(':id/documents')
  async getDocuments(
    @Param('id') id: string,
    @Query('folderId') folderId?: string,
  ): Promise<KnowledgeDocumentListResp> {
    return this.knowledgeService.getDocuments(id, folderId);
  }

  @NeedLogin()
  @CanRole(['admin'])
  @Delete(':id/documents/:docId')
  async deleteDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
  ): Promise<{ success: boolean }> {
    const success = await this.knowledgeService.deleteDocument(id, docId);
    return { success };
  }
}
