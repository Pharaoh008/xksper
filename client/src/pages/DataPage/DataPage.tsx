import React, { useState, useEffect } from 'react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@client/src/components/ui/card';
import { Label } from '@client/src/components/ui/label';
import { toast } from 'sonner';
import { 
  Loader2, 
  Table2, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ExternalLink,
  Settings
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@client/src/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import { showConfirm } from '@lark-apaas/client-toolkit';

interface DataSource {
  id: string;
  name: string;
  type: string;
  baseToken: string;
  tableId: string;
  viewId?: string;
  description?: string;
  isActive: boolean;
  syncStatus: 'pending' | 'syncing' | 'success' | 'failed';
  lastSyncAt?: string;
  recordCount: number;
  createdAt: string;
}

interface SyncedRecord {
  id: string;
  recordId: string;
  data: Record<string, any>;
}

const parseFeishuUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/base\/([a-zA-Z0-9]+)/);
    const baseToken = pathMatch ? pathMatch[1] : '';
    const tableId = urlObj.searchParams.get('table') || '';
    const viewId = urlObj.searchParams.get('view') || '';
    return { baseToken, tableId, viewId };
  } catch {
    return { baseToken: '', tableId: '', viewId: '' };
  }
};

const DataPage: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [records, setRecords] = useState<SyncedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    baseToken: '',
    tableId: '',
    viewId: '',
    description: '',
  });

  useEffect(() => {
    fetchDataSources();
  }, []);

  useEffect(() => {
    if (selectedSource) {
      fetchSyncedData(selectedSource.id);
    }
  }, [selectedSource]);

  const fetchDataSources = async () => {
    try {
      const response = await axiosForBackend.get('/api/data-sources');
      setDataSources(response.data);
    } catch (error: any) {
      toast.error('获取数据源失败');
    }
  };

  const fetchSyncedData = async (sourceId: string) => {
    setIsLoading(true);
    try {
      const response = await axiosForBackend.get(`/api/data-sources/${sourceId}/data`);
      setRecords(response.data);
    } catch (error: any) {
      toast.error('获取同步数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlChange = (url: string) => {
    setUrlInput(url);
    const parsed = parseFeishuUrl(url);
    if (parsed.baseToken && parsed.tableId) {
      setFormData(prev => ({
        ...prev,
        baseToken: parsed.baseToken,
        tableId: parsed.tableId,
        viewId: parsed.viewId,
      }));
    }
  };

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('请输入数据源名称');
      return;
    }
    if (!formData.baseToken || !formData.tableId) {
      toast.error('请粘贴有效的飞书多维表格链接');
      return;
    }
    
    try {
      await axiosForBackend.post('/api/data-sources', formData);
      toast.success('数据源创建成功');
      setIsCreateDialogOpen(false);
      setFormData({ name: '', baseToken: '', tableId: '', viewId: '', description: '' });
      setUrlInput('');
      fetchDataSources();
    } catch (error: any) {
      toast.error(error.response?.data?.message || '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定要删除这个数据源吗？同步的数据也会被删除。')) return;
    
    try {
      await axiosForBackend.delete(`/api/data-sources/${id}`);
      toast.success('删除成功');
      if (selectedSource?.id === id) {
        setSelectedSource(null);
        setRecords([]);
      }
      fetchDataSources();
    } catch (error: any) {
      toast.error('删除失败');
    }
  };

  const handleSync = async (id: string) => {
    setIsSyncing(true);
    try {
      const response = await axiosForBackend.post(`/api/data-sources/${id}/sync`);
      toast.success(`同步成功，共 ${response.data.recordCount} 条记录`);
      fetchDataSources();
      if (selectedSource?.id === id) {
        fetchSyncedData(id);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return '同步成功';
      case 'failed':
        return '同步失败';
      case 'syncing':
        return '同步中';
      default:
        return '待同步';
    }
  };

  const renderRecordValue = (value: any) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      if (value.text) return value.text;
      if (Array.isArray(value)) return value.join(', ');
      return JSON.stringify(value);
    }
    return String(value);
  };

  const filteredRecords = records.filter(record => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return Object.values(record.data).some(val => 
      renderRecordValue(val).toLowerCase().includes(searchLower)
    );
  });

  const allFields = records.length > 0 
    ? Array.from(new Set(records.flatMap(r => Object.keys(r.data))))
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            数据同步
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理飞书多维表格数据源，支持多表同步
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              添加数据源
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>添加飞书多维表格</DialogTitle>
              <DialogDescription>
                粘贴多维表格链接即可自动提取配置信息
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>多维表格链接 *</Label>
                <Input
                  placeholder="https://xxx.feishu.cn/base/xxx?table=xxx"
                  value={urlInput}
                  onChange={(e) => handleUrlChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  粘贴飞书多维表格分享链接，系统会自动提取配置信息
                </p>
              </div>
              <div className="space-y-2">
                <Label>数据源名称 *</Label>
                <Input
                  placeholder="例如：客户信息表"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Input
                  placeholder="可选：描述这个数据源的用途"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate}>
                创建并同步
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="sources" className="w-full">
        <TabsList>
          <TabsTrigger value="sources">数据源列表</TabsTrigger>
          <TabsTrigger value="data" disabled={!selectedSource}>
            数据预览
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4">
          {dataSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
              <div className="text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Database className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-foreground">暂无数据源</p>
                  <p className="text-sm text-muted-foreground">
                    添加飞书多维表格，同步数据到系统中
                  </p>
                </div>
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="px-6"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加飞书多维表格
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dataSources.map((source) => (
                <Card 
                  key={source.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedSource?.id === source.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedSource(source)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Table2 className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{source.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(source.syncStatus)}
                      </div>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {source.description || '暂无描述'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">同步状态</span>
                        <span className={`
                          ${source.syncStatus === 'success' ? 'text-green-600' : ''}
                          ${source.syncStatus === 'failed' ? 'text-red-600' : ''}
                          ${source.syncStatus === 'syncing' ? 'text-blue-600' : ''}
                        `}>
                          {getStatusText(source.syncStatus)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">记录数</span>
                        <span>{source.recordCount}</span>
                      </div>
                      {source.lastSyncAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">上次同步</span>
                          <span>{new Date(source.lastSyncAt).toLocaleString('zh-CN')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSync(source.id);
                        }}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="ml-1">同步</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(source.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          {selectedSource && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedSource.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {records.length} 条记录
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索数据..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleSync(selectedSource.id)}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">重新同步</span>
                  </Button>
                </div>
              </div>

              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : filteredRecords.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      {searchQuery ? '未找到匹配的数据' : '暂无数据，请先同步'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {allFields.slice(0, 10).map((field) => (
                              <TableHead key={field} className="whitespace-nowrap">
                                {field}
                              </TableHead>
                            ))}
                            {allFields.length > 10 && (
                              <TableHead>...还有 {allFields.length - 10} 个字段</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRecords.slice(0, 100).map((record) => (
                            <TableRow key={record.id}>
                              {allFields.slice(0, 10).map((field) => (
                                <TableCell key={field} className="whitespace-nowrap max-w-[200px] truncate">
                                  {renderRecordValue(record.data[field])}
                                </TableCell>
                              ))}
                              {allFields.length > 10 && <TableCell>...</TableCell>}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {filteredRecords.length > 100 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      仅显示前 100 条记录，共 {filteredRecords.length} 条
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataPage;
