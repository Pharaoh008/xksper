import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Search, MoreHorizontal, Pencil, Trash2, Upload, Link2, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DraggableDialogContent } from '@/components/ui/draggable-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getKnowledgeBaseList,
  createKnowledgeBase as apiCreateKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase as apiDeleteKnowledgeBase,
  getOrganizationList,
  uploadDocumentToKnowledgeBase,
} from '@/api';
import type { KnowledgeBase, CreateKnowledgeBaseRequest, Organization } from '@shared/api.interface';

const readKnowledgeFileContent = async (file: File): Promise<string | undefined> => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (file.type.startsWith('text/') || ['txt', 'md', 'markdown', 'csv', 'json'].includes(ext || '')) {
    return file.text();
  }
  return undefined;
};

const KnowledgePage: React.FC = () => {
  const navigate = useNavigate();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null);
  const [newKB, setNewKB] = useState<CreateKnowledgeBaseRequest>({
    name: '',
    description: '',
    type: 'local',
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchKnowledgeBases = useCallback(async () => {
    try {
      const data = await getKnowledgeBaseList(selectedOrgId || undefined);
      setKnowledgeBases(data.items);
    } catch (error) {
      logger.error('获取知识库列表失败', error);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  const fetchOrganizations = useCallback(async () => {
    try {
      const data = await getOrganizationList();
      setOrganizations(data.items);
    } catch (error) {
      logger.error('获取组织列表失败', error);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleCreate = async () => {
    if (!newKB.name.trim()) {
      toast.error('请输入知识库名称');
      return;
    }
    try {
      await apiCreateKnowledgeBase(newKB);
      setCreateDialogOpen(false);
      setNewKB({ name: '', description: '', type: 'local' });
      fetchKnowledgeBases();
      toast.success('创建成功');
    } catch (error) {
      logger.error('创建知识库失败', error);
      toast.error('创建知识库失败');
    }
  };

  const handleEdit = (kb: KnowledgeBase) => {
    setEditingKB(kb);
    setNewKB({
      name: kb.name,
      description: kb.description || '',
      type: kb.type,
      feishuToken: kb.feishuToken,
      feishuSpaceId: kb.feishuSpaceId,
      organizationId: kb.organizationId,
    });
    setCreateDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingKB || !newKB.name.trim()) {
      toast.error('请输入知识库名称');
      return;
    }
    try {
      await updateKnowledgeBase(editingKB.id, newKB);
      setCreateDialogOpen(false);
      setEditingKB(null);
      setNewKB({ name: '', description: '', type: 'local' });
      fetchKnowledgeBases();
      toast.success('更新成功');
    } catch (error) {
      logger.error('更新知识库失败', error);
      toast.error('更新知识库失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDeleteKnowledgeBase(id);
      fetchKnowledgeBases();
      toast.success('删除成功');
    } catch (error) {
      logger.error('删除知识库失败', error);
      toast.error('删除知识库失败');
    }
  };

  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    setEditingKB(null);
    setNewKB({ name: '', description: '', type: 'local' });
    setUploadFile(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleCreateWithFile = async () => {
    if (!newKB.name.trim()) {
      toast.error('请输入知识库名称');
      return;
    }
    try {
      setIsUploading(true);
      // 1. 创建知识库
      const kb = await apiCreateKnowledgeBase(newKB);
      
      // 2. 如果有文件，上传到知识库
      if (uploadFile && kb.id) {
        const content = await readKnowledgeFileContent(uploadFile);
        const ext = uploadFile.name.split('.').pop()?.toLowerCase();

        await uploadDocumentToKnowledgeBase(kb.id, {
          name: uploadFile.name,
          filePath: `inline://${Date.now()}-${uploadFile.name}`,
          fileSize: uploadFile.size,
          fileType: uploadFile.type || ext || 'application/octet-stream',
          content,
        });
      }
      
      setCreateDialogOpen(false);
      setNewKB({ name: '', description: '', type: 'local' });
      setUploadFile(null);
      fetchKnowledgeBases();
      toast.success('创建成功');
    } catch (error) {
      logger.error('创建知识库或上传文件失败', error);
      toast.error('创建知识库或上传文件失败');
    } finally {
      setIsUploading(false);
    }
  };

  const getOrgName = (orgId?: string) => {
    if (!orgId) return '全局';
    const org = organizations.find((o) => o.id === orgId);
    return org?.name || '未知组织';
  };

  const filteredKBs = knowledgeBases.filter(
    (kb) =>
      kb.name.toLowerCase().includes(search.toLowerCase()) ||
      kb.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">知识库</h1>
          <p className="text-muted-foreground text-sm mt-1">管理AI知识库，支持本地文档和飞书知识库</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建知识库
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="全部组织" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部组织</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索知识库..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2"></CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredKBs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无知识库</p>
            <Button variant="outline" className="mt-4" onClick={() => setCreateDialogOpen(true)}>
              创建第一个知识库
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKBs.map((kb) => (
            <Card
              key={kb.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/knowledge/${kb.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{kb.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(kb); }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); handleDelete(kb.id); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {kb.description || '暂无描述'}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={kb.type === 'local' ? 'default' : 'secondary'}>
                    {kb.type === 'local' ? (
                      <>
                        <Upload className="h-3 w-3 mr-1" />
                        本地文档
                      </>
                    ) : (
                      <>
                        <Link2 className="h-3 w-3 mr-1" />
                        飞书知识库
                      </>
                    )}
                  </Badge>
                  <Badge variant="outline">
                    {getOrgName(kb.organizationId)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={handleCloseDialog}>
        <DraggableDialogContent>
          <DialogHeader>
            <DialogTitle>{editingKB ? '编辑知识库' : '创建知识库'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={newKB.name}
                onChange={(e) => setNewKB({ ...newKB, name: e.target.value })}
                placeholder="输入知识库名称"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={newKB.description || ''}
                onChange={(e) => setNewKB({ ...newKB, description: e.target.value })}
                placeholder="输入知识库描述"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>类型</Label>
              <div className="flex gap-4">
                <Button
                  variant={newKB.type === 'local' ? 'default' : 'outline'}
                  onClick={() => setNewKB({ ...newKB, type: 'local' })}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  本地文档
                </Button>
                <Button
                  variant={newKB.type === 'feishu' ? 'default' : 'outline'}
                  onClick={() => setNewKB({ ...newKB, type: 'feishu' })}
                  className="flex-1"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  飞书知识库
                </Button>
              </div>
              {newKB.type === 'local' && !editingKB && (
                <div className="mt-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif"
                  />
                  {!uploadFile ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      选择文件上传（可选）
                    </Button>
                  ) : (
                    <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm truncate max-w-[200px]">{uploadFile.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(uploadFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setUploadFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {newKB.type === 'feishu' && (
              <>
                <div className="space-y-2">
                  <Label>飞书访问令牌</Label>
                  <Input
                    value={newKB.feishuToken || ''}
                    onChange={(e) => setNewKB({ ...newKB, feishuToken: e.target.value })}
                    placeholder="输入飞书访问令牌"
                  />
                </div>
                <div className="space-y-2">
                  <Label>知识库空间ID</Label>
                  <Input
                    value={newKB.feishuSpaceId || ''}
                    onChange={(e) => setNewKB({ ...newKB, feishuSpaceId: e.target.value })}
                    placeholder="输入飞书知识库空间ID"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>组织</Label>
              <Select
                value={newKB.organizationId || 'global'}
                onValueChange={(value) =>
                  setNewKB({
                    ...newKB,
                    organizationId: value === 'global' ? undefined : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择组织" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">全局</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isUploading}>
              取消
            </Button>
            <Button 
              onClick={editingKB ? handleUpdate : handleCreateWithFile}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  上传中...
                </>
              ) : editingKB ? (
                '保存'
              ) : (
                '创建'
              )}
            </Button>
          </DialogFooter>
        </DraggableDialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgePage;
