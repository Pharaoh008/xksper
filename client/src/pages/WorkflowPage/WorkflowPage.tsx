import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableProps } from '@lark-apaas/client-toolkit/antd-table';
import { Plus, ExternalLink, Settings, Workflow, AlertCircle } from 'lucide-react';
import { getWorkflowList, deleteWorkflow } from '@/api';
import type { Workflow as WorkflowType, WorkflowListResp } from '@shared/api.interface';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface N8nConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  webhookUrl?: string;
}

const STORAGE_KEY = 'n8n_config';

const WorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowType[]>([]);
  const [loading, setLoading] = useState(false);
  const [n8nConfig, setN8nConfig] = useState<N8nConfig | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setN8nConfig(parsed);
      } catch {
        logger.error('n8n 配置解析失败');
      }
    }
  }, []);

  useEffect(() => {
    // 如果未启用 n8n，加载原有工作流列表
    if (!n8nConfig?.enabled) {
      fetchWorkflows();
    }
  }, [n8nConfig]);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const data: WorkflowListResp = await getWorkflowList();
      setWorkflows(data.items);
    } catch (error) {
      logger.error('获取工作流列表失败', error);
      toast.error('获取工作流列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkflow(id);
      toast.success('删除成功');
      fetchWorkflows();
    } catch (error) {
      logger.error('删除工作流失败', error);
      toast.error('删除失败');
    }
  };

  const columns: TableProps<WorkflowType>['columns'] = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 250,
      render: (name: string) => (
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          <span className="font-medium">{name}</span>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (desc: string) => desc || '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      width: 100,
      align: 'center',
      render: (isActive: boolean) => (
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isActive ? '已启用' : '已禁用'}
        </Badge>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/workflow/${record.id}`)}
          >
            编辑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </div>
      ),
    },
  ];

  // 如果启用了 n8n，显示嵌入的编辑器
  if (n8nConfig?.enabled && n8nConfig.baseUrl) {
    const n8nUrl = n8nConfig.baseUrl.replace(/\/$/, '');
    
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Workflow className="h-6 w-6 text-primary" />
              n8n 工作流编辑器
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              使用 n8n 开源工作流平台创建工作流
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.open(n8nUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              新窗口打开
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/n8n-config')}
            >
              <Settings className="h-4 w-4 mr-2" />
              配置
            </Button>
          </div>
        </div>
        
        <div className="flex-1 rounded-lg overflow-hidden border border-border shadow-sm">
          <iframe
            src={n8nUrl}
            className="w-full h-full"
            style={{ border: 'none' }}
            title="n8n Workflow Editor"
            allow="clipboard-read; clipboard-write"
          />
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-center">
          如果无法显示，请检查 n8n 服务是否正常运行，或点击"新窗口打开"
        </p>
      </div>
    );
  }

  // 未启用 n8n，显示原有工作流列表 + 配置提示
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Workflow className="h-6 w-6 text-primary" />
            工作流管理
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            创建和管理 AI 工作流
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/n8n-config')}
          >
            <Settings className="h-4 w-4 mr-2" />
            n8n 配置
          </Button>
          <Button onClick={() => navigate('/workflow/new')}>
            <Plus className="h-4 w-4 mr-2" />
            创建工作流
          </Button>
        </div>
      </div>

      {/* n8n 推广卡片 */}
      <Card className="mb-6 border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900">推荐使用 n8n 开源工作流</h4>
              <p className="text-sm text-blue-700 mt-1">
                n8n 是强大的开源工作流自动化工具，支持 400+ 集成，可视化编辑器，
                可以完全替代内置工作流功能。
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  onClick={() => navigate('/n8n-config')}
                >
                  立即配置
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-blue-700 hover:bg-blue-100"
                  onClick={() => window.open('https://n8n.io', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  了解 n8n
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>工作流列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            columns={columns}
            dataSource={workflows}
            loading={loading}
            rowKey="id"
            scroll={{ x: 800 }}
            pagination={false}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkflowPage;
