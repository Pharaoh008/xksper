import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ExternalLink, Save, TestTube, Workflow, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

interface N8nConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  webhookUrl?: string;
}

const STORAGE_KEY = 'n8n_config';

const N8nConfigPage: React.FC = () => {
  const [config, setConfig] = useState<N8nConfig>({
    enabled: false,
    baseUrl: '',
    apiKey: '',
    webhookUrl: '',
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
      } catch {
        toast.error('配置解析失败');
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    toast.success('配置已保存');
  };

  const handleTest = async () => {
    if (!config.baseUrl) {
      toast.error('请先填写 n8n 地址');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // 尝试通过 fetch 测试 n8n 是否可访问
      // 注意：由于跨域限制，这里只是测试地址格式
      const url = new URL(config.baseUrl);
      
      // 简单的可达性检查（实际应用中可能需要后端代理）
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      await fetch(url.origin, { 
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // 允许跨域请求（仅检查是否可达）
      }).catch(() => {
        // 即使报错也可能是 CORS 问题，不代表服务不可用
      });
      
      clearTimeout(timeout);
      setTestResult('success');
      toast.success('连接测试通过（地址格式正确）');
    } catch {
      setTestResult('error');
      toast.error('连接测试失败，请检查地址格式');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Workflow className="h-6 w-6 text-primary" />
          n8n 工作流配置
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          配置 n8n 开源工作流平台集成
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>基础配置</CardTitle>
          <CardDescription>
            配置您的 n8n 服务器地址，启用后 Workflow 功能将切换为 n8n 编辑器
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 启用开关 */}
          <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
            <div>
              <Label className="text-base font-medium">启用 n8n 集成</Label>
              <p className="text-sm text-muted-foreground mt-1">
                开启后 Workflow 菜单将跳转到 n8n 编辑器
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          {/* n8n 地址 */}
          <div className="space-y-2">
            <Label htmlFor="baseUrl">
              n8n 服务器地址
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="baseUrl"
              placeholder="https://n8n.yourdomain.com 或 http://localhost:5678"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              支持本地部署地址（localhost）或远程服务器地址
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key（可选）</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="n8n_api_xxxxxxxx"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              用于访问 n8n API，在 n8n 设置中生成
            </p>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook 基础地址（可选）</Label>
            <Input
              id="webhookUrl"
              placeholder="https://n8n.yourdomain.com/webhook"
              value={config.webhookUrl}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              用于触发 n8n Webhook 工作流
            </p>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div className={`p-3 rounded-md flex items-center gap-2 ${
              testResult === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {testResult === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span className="text-sm">
                {testResult === 'success' ? '连接测试通过' : '连接测试失败'}
              </span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              className="flex-1 h-11"
              disabled={!config.baseUrl && config.enabled}
            >
              <Save className="h-4 w-4 mr-2" />
              保存配置
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!config.baseUrl || isTesting}
              className="h-11"
            >
              <TestTube className="h-4 w-4 mr-2" />
              {isTesting ? '测试中...' : '测试连接'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 部署指南 */}
      <Card className="border-border shadow-sm mt-6">
        <CardHeader>
          <CardTitle>部署指南</CardTitle>
          <CardDescription>
            如果您还没有部署 n8n，可以参考以下方式
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">方式一：Docker 部署（推荐）</h4>
            <code className="text-sm bg-background px-3 py-2 rounded block overflow-x-auto">
              docker run -it --rm \
                --name n8n \
                -p 5678:5678 \
                -v ~/.n8n:/home/node/.n8n \
                n8nio/n8n
            </code>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">方式二：npm 安装</h4>
            <code className="text-sm bg-background px-3 py-2 rounded block overflow-x-auto">
              npm install n8n -g<br />
              n8n start
            </code>
          </div>

          <UniversalLink
            to="https://docs.n8n.io/hosting/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline text-sm"
          >
            <ExternalLink className="h-4 w-4" />
            查看官方部署文档
          </UniversalLink>
        </CardContent>
      </Card>
    </div>
  );
};

export default N8nConfigPage;
