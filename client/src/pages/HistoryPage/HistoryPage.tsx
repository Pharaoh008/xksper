import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import {
  getConversationList,
  deleteConversation,
  batchDeleteConversations,
} from '@/api/index';
import type { Conversation } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

const HistoryPage: React.FC = () => {
  const navigate = useNavigate();

  // 状态
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'single' | 'batch';
    id?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 获取会话列表
  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getConversationList({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
      });
      setConversations(response.items);
      setTotal(response.total);
      // 清空选择
      setSelectedIds(new Set());
    } catch (error) {
      logger.error('获取会话列表失败', error);
      toast.error('获取会话列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 搜索处理
  const handleSearch = () => {
    setKeyword(searchKeyword);
    setPage(1);
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchKeyword(e.target.value);
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 恢复会话
  const handleRestoreConversation = (conversation: Conversation) => {
    // 跳转到首页并传递会话ID
    navigate('/', { state: { conversationId: conversation.id } });
  };

  // 单条删除
  const handleSingleDelete = (id: string) => {
    setDeleteTarget({ type: 'single', id });
    setDeleteDialogOpen(true);
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget({ type: 'batch' });
    setDeleteDialogOpen(true);
  };

  // 确认删除
  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'single' && deleteTarget.id) {
        await deleteConversation(deleteTarget.id);
        toast.success('会话已删除');
      } else if (deleteTarget.type === 'batch') {
        const ids = Array.from(selectedIds);
        await batchDeleteConversations(ids);
        toast.success(`已删除 ${ids.length} 条会话`);
      }

      // 刷新列表
      fetchConversations();
    } catch (error) {
      logger.error('删除会话失败', error);
      toast.error('删除会话失败');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  // 选择处理
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(conversations.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // 分页计算
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  // 渲染分页
  const renderPagination = () => {
    const items: React.ReactNode[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink onClick={() => setPage(i)} isActive={page === i}>
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // 复杂分页
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) {
          items.push(
            <PaginationItem key={i}>
              <PaginationLink onClick={() => setPage(i)} isActive={page === i}>
                {i}
              </PaginationLink>
            </PaginationItem>
          );
        }
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink onClick={() => setPage(totalPages)}>
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      } else if (page >= totalPages - 2) {
        items.push(
          <PaginationItem key={1}>
            <PaginationLink onClick={() => setPage(1)}>1</PaginationLink>
          </PaginationItem>
        );
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
        for (let i = totalPages - 3; i <= totalPages; i++) {
          items.push(
            <PaginationItem key={i}>
              <PaginationLink onClick={() => setPage(i)} isActive={page === i}>
                {i}
              </PaginationLink>
            </PaginationItem>
          );
        }
      } else {
        items.push(
          <PaginationItem key={1}>
            <PaginationLink onClick={() => setPage(1)}>1</PaginationLink>
          </PaginationItem>
        );
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
        for (let i = page - 1; i <= page + 1; i++) {
          items.push(
            <PaginationItem key={i}>
              <PaginationLink onClick={() => setPage(i)} isActive={page === i}>
                {i}
              </PaginationLink>
            </PaginationItem>
          );
        }
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink onClick={() => setPage(totalPages)}>
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={(e) => {
                e.preventDefault();
                setPage((p) => Math.max(1, p - 1));
              }}
              aria-disabled={page === 1}
              className={page === 1 ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          {items}
          <PaginationItem>
            <PaginationNext
              onClick={(e) => {
                e.preventDefault();
                setPage((p) => Math.min(totalPages, p + 1));
              }}
              aria-disabled={page === totalPages}
              className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">历史对话</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理和查看所有历史会话记录
        </p>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center gap-4 mb-6">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索会话标题..."
            value={searchKeyword}
            onChange={handleKeywordChange}
            onKeyDown={handleKeywordKeyDown}
            className="pl-10"
          />
        </div>

        {/* 批量删除按钮 */}
        {selectedIds.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleBatchDelete}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            批量删除 ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* 表格 */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    conversations.length > 0 &&
                    selectedIds.size === conversations.length
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[50px]">序号</TableHead>
              <TableHead>会话标题</TableHead>
              <TableHead className="w-[150px]">模型</TableHead>
              <TableHead className="w-[100px] text-right">消息数</TableHead>
              <TableHead className="w-[180px]">创建时间</TableHead>
              <TableHead className="w-[150px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>加载中...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : conversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  暂无会话记录
                </TableCell>
              </TableRow>
            ) : (
              conversations.map((conversation, index) => (
                <TableRow
                  key={conversation.id}
                  className="cursor-pointer group"
                  onClick={() => handleRestoreConversation(conversation)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(conversation.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(conversation.id, !!checked)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(page - 1) * PAGE_SIZE + index + 1}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium group-hover:text-primary transition-colors">
                      {conversation.title || '未命名会话'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{conversation.model}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {conversation.messageCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dayjs(conversation.createdAt).format(
                      'YYYY-MM-DD HH:mm'
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleRestoreConversation(conversation)
                        }
                        className="gap-1"
                      >
                        <RotateCcw className="h-4 w-4" />
                        恢复
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSingleDelete(conversation.id)}
                        className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页信息 */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <span className="text-sm text-muted-foreground">
            共 {total} 条记录，显示 {startItem}-{endItem} 条
          </span>
          {renderPagination()}
        </div>
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'single'
                ? '确定要删除这条会话吗？删除后将无法恢复。'
                : `确定要删除选中的 ${selectedIds.size} 条会话吗？删除后将无法恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  删除中...
                </>
              ) : (
                '确认删除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HistoryPage;
