import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  File as FileIcon,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getDataloom } from '@lark-apaas/client-toolkit/dataloom';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { getDefaultBucketId } from '@lark-apaas/client-toolkit/tools/storage';
import {
  getKnowledgeBase,
  getKnowledgeBaseDocuments,
  uploadDocumentToKnowledgeBase,
  deleteKnowledgeBaseDocument,
} from '@/api';
import type { KnowledgeBase, KnowledgeDocument } from '@shared/api.interface';

const ACCEPTED_FILE_TYPES = {
  'application/pdf': { icon: FileText, label: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: FileText, label: 'Word' },
  'application/msword': { icon: FileText, label: 'Word' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: FileSpreadsheet, label: 'Excel' },
  'application/vnd.ms-excel': { icon: FileSpreadsheet, label: 'Excel' },
  'text/plain': { icon: FileText, label: 'Text' },
  'text/markdown': { icon: FileText, label: 'Markdown' },
  'image/png': { icon: FileImage, label: 'PNG' },
  'image/jpeg': { icon: FileImage, label: 'JPEG' },
  'image/jpg': { icon: FileImage, label: 'JPG' },
  'image/webp': { icon: FileImage, label: 'WebP' },
  'image/gif': { icon: FileImage, label: 'GIF' },
};

const getFileIcon = (fileType?: string) => {
  if (!fileType) return FileIcon;
  const config = ACCEPTED_FILE_TYPES[fileType as keyof typeof ACCEPTED_FILE_TYPES];
  return config?.icon || FileIcon;
};

const getFileLabel = (fileType?: string) => {
  if (!fileType) return '文件';
  const config = ACCEPTED_FILE_TYPES[fileType as keyof typeof ACCEPTED_FILE_TYPES];
  return config?.label || '文件';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 提取文件内容的函数
const extractFileContent = async (file: File): Promise<string | undefined> => {
  logger.info('提取文件内容:', { name: file.name, type: file.type, size: file.size });
  
  // 获取文件扩展名作为备用检查
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  try {
    // Excel 文件
    if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        ext === 'xlsx' || ext === 'xls') {
      logger.info('解析 Excel 文件');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      let content = '';
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        content += `Sheet: ${sheetName}\n`;
        content += XLSX.utils.sheet_to_csv(worksheet) + '\n\n';
      });
      logger.info('Excel 解析完成, 内容长度:', content.length);
      return content;
    }
    // Word 文档 - 支持 MIME 类型和扩展名检查
    else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
             file.type === 'application/msword' ||
             file.type === 'application/octet-stream' ||
             ext === 'docx' || ext === 'doc') {
      logger.info('解析 Word 文档');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      logger.info('Word 解析完成, 内容长度:', result.value?.length || 0);
      return result.value;
    }
    // 文本文件
    else if (file.type === 'text/plain' || file.type === 'text/markdown' ||
             ext === 'txt' || ext === 'md') {
      logger.info('解析文本文件');
      const content = await file.text();
      logger.info('文本解析完成, 内容长度:', content.length);
      return content;
    }
    else {
      logger.warn('不支持的文件类型:', file.type, '扩展名:', ext);
    }
  } catch (error) {
    logger.error('提取文件内容失败:', error);
  }
  return undefined;
};

const KnowledgeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<KnowledgeDocument | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [kbData, docsData] = await Promise.all([
        getKnowledgeBase(id),
        getKnowledgeBaseDocuments(id),
      ]);
      setKnowledgeBase(kbData);
      setDocuments(docsData.items);
    } catch (error) {
      logger.error('获取知识库详情失败', error);
      toast.error('获取知识库详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    // 检查文件类型
    if (!ACCEPTED_FILE_TYPES[file.type as keyof typeof ACCEPTED_FILE_TYPES]) {
      toast.error('不支持的文件格式，请上传 PDF、Word、Excel、TXT、Markdown 或图片文件');
      return;
    }

    // 检查文件大小 (最大 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('文件大小超过 50MB 限制');
      return;
    }

    setUploading(true);
    try {
      const dataloom = await getDataloom();

      // 上传文件到存储
      const { data: uploadResult, error } = await dataloom
        .storage
        .from(await getDefaultBucketId())
        .uploadFile(file);

      if (error || !uploadResult) {
        throw new Error('文件上传失败: ' + (error?.message || '未知错误'));
      }

      // 提取文件内容
      const content = await extractFileContent(file);

      // 保存文档信息到知识库
      await uploadDocumentToKnowledgeBase(id, {
        name: file.name,
        filePath: uploadResult.file_path,
        fileSize: file.size,
        fileType: file.type,
        content,
      });

      toast.success('文档上传成功');
      fetchData();
    } catch (error) {
      logger.error('上传文档失败', error);
      toast.error('上传文档失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteClick = (doc: KnowledgeDocument) => {
    setDocToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete || !id) return;

    setDeletingDocId(docToDelete.id);
    try {
      await deleteKnowledgeBaseDocument(id, docToDelete.id);
      toast.success('文档删除成功');
      fetchData();
    } catch (error) {
      logger.error('删除文档失败', error);
      toast.error('删除文档失败');
    } finally {
      setDeletingDocId(null);
      setDeleteDialogOpen(false);
      setDocToDelete(null);
    }
  };

  const getStatusIcon = (status: KnowledgeDocument['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: KnowledgeDocument['status']) => {
    const variants: Record<KnowledgeDocument['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'outline', label: '待处理' },
      processing: { variant: 'default', label: '处理中' },
      completed: { variant: 'secondary', label: '已完成' },
      error: { variant: 'destructive', label: '失败' },
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!knowledgeBase) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="text-center py-12">
          <p className="text-muted-foreground">知识库不存在</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/knowledge')}>
            返回知识库列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* 头部 */}
      <div className="mb-6">
        <Button variant="ghost" className="mb-4 -ml-4" onClick={() => navigate('/knowledge')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回知识库列表
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{knowledgeBase.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {knowledgeBase.description || '暂无描述'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif"
              onChange={handleFileSelect}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  上传文档
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 支持的文件类型说明 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium">支持的文件格式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ACCEPTED_FILE_TYPES).map(([mime, config]) => (
              <Badge key={mime} variant="outline">
                {config.label}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">单个文件最大 50MB</p>
        </CardContent>
      </Card>

      {/* 文档列表 */}
      <Card>
        <CardHeader>
          <CardTitle>文档列表</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <File className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">暂无文档</p>
              <p className="text-sm text-muted-foreground mt-1">点击上方"上传文档"按钮添加文件</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const FileIconComponent = getFileIcon(doc.fileType);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileIconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{doc.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{getFileLabel(doc.fileType)}</span>
                          <span>·</span>
                          <span>{formatFileSize(doc.fileSize)}</span>
                          {doc.tokenCount > 0 && (
                            <>
                              <span>·</span>
                              <span>{doc.tokenCount.toLocaleString()} tokens</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(doc.status)}
                        {getStatusBadge(doc.status)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteClick(doc)}
                        disabled={deletingDocId === doc.id}
                      >
                        {deletingDocId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 删除文档对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            确定要删除文档 <span className="font-medium text-foreground">"{docToDelete?.name}"</span> 吗？
            此操作不可恢复。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={!!deletingDocId}>
              {deletingDocId ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeDetailPage;
