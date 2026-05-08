import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Server, Cloud, Search, Loader2, Zap, Sparkles, Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DraggableDialogContent } from '@/components/ui/draggable-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getToolList, createTool, updateTool, deleteTool, testToolConnection, parseSkillFile, type CreateToolRequest, type UpdateToolRequest, type SkillParseResult } from '@/api/index';
import { Tool } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { showConfirm } from '@lark-apaas/client-toolkit';

const ToolPage: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateToolRequest>({
    name: '',
    type: 'mcp',
    description: '',
    configData: {},
  });

  const [mcpConfig, setMcpConfig] = useState({
    url: '',
    headers: [{ key: '', value: '' }],
  });

  const [pluginConfig, setPluginConfig] = useState({
    pluginKey: '',
    instanceId: '',
  });

  const [skillConfig, setSkillConfig] = useState({
    content: '',
    fileType: 'markdown' as 'markdown' | 'zip',
    fileName: '',
  });

  const [parsedSkill, setParsedSkill] = useState<SkillParseResult | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const addHeader = () => {
    setMcpConfig(prev => ({
      ...prev,
      headers: [...prev.headers, { key: '', value: '' }],
    }));
  };

  const removeHeader = (index: number) => {
    setMcpConfig(prev => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index),
    }));
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    setMcpConfig(prev => ({
      ...prev,
      headers: prev.headers.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
    }));
  };

  const fetchTools = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getToolList();
      setTools(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error || '未知错误');
      logger.error('获取工具列表失败', errorMessage);
      toast.error(`获取工具列表失败: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const filteredTools = tools.filter((tool) => {
    const matchType = filterType === 'all' || tool.type === filterType;
    const matchSearch = !searchKeyword || tool.name.toLowerCase().includes(searchKeyword.toLowerCase());
    return matchType && matchSearch;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['md', 'markdown', 'zip'].includes(fileExtension || '')) {
      toast.error('仅支持 .md, .markdown, .zip 文件');
      return;
    }

    setUploadingFile(true);
    try {
      const result = await parseSkillFile(file);
      setParsedSkill(result);
      setSkillConfig({
        content: result.content || '',
        fileType: result.fileType || (fileExtension === 'zip' ? 'zip' : 'markdown'),
        fileName: file.name,
      });
      if (result.name && !formData.name) {
        setFormData(prev => ({ ...prev, name: result.name }));
      }
      if (result.description && !formData.description) {
        setFormData(prev => ({ ...prev, description: result.description || '' }));
      }
      toast.success('文件解析成功');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error || '未知错误');
      logger.error('解析 Skill 文件失败', errorMessage);
      toast.error(`文件解析失败: ${errorMessage}`);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOpenDialog = (tool?: Tool) => {
    if (tool) {
      setEditingTool(tool);
      setFormData({
        name: tool.name,
        type: tool.type,
        description: tool.description || '',
        configData: tool.configData || {},
      });

      if (tool.type === 'mcp' && tool.configData) {
        setMcpConfig({
          url: (tool.configData.url as string) || '',
          headers: (tool.configData.headers as unknown as Array<{key: string; value: string}>) || [{ key: '', value: '' }],
        });
        setPluginConfig({ pluginKey: '', instanceId: '' });
        setSkillConfig({ content: '', fileType: 'markdown', fileName: '' });
        setParsedSkill(null);
      } else if (tool.type === 'cloud_plugin' && tool.configData) {
        setPluginConfig({
          pluginKey: (tool.configData.pluginKey as string) || '',
          instanceId: (tool.configData.instanceId as string) || '',
        });
        setMcpConfig({ url: '', headers: [{ key: '', value: '' }] });
        setSkillConfig({ content: '', fileType: 'markdown', fileName: '' });
        setParsedSkill(null);
      } else if (tool.type === 'skill' && tool.skill) {
        setSkillConfig({
          content: tool.skill.content || '',
          fileType: tool.skill.fileType || 'markdown',
          fileName: tool.skill.name || '',
        });
        setParsedSkill({
          name: tool.skill.name || '',
          description: tool.skill.description,
          inputSchema: tool.skill.inputSchema || [],
          outputSchema: tool.skill.outputSchema || [],
          examples: tool.skill.examples || [],
          metadata: tool.skill.metadata,
          version: tool.skill.version,
        });
        setMcpConfig({ url: '', headers: [{ key: '', value: '' }] });
        setPluginConfig({ pluginKey: '', instanceId: '' });
      }
    } else {
      setEditingTool(null);
      setFormData({ name: '', type: 'mcp', description: '', configData: {} });
      setMcpConfig({ url: '', headers: [{ key: '', value: '' }] });
      setPluginConfig({ pluginKey: '', instanceId: '' });
      setSkillConfig({ content: '', fileType: 'markdown', fileName: '' });
      setParsedSkill(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTool(null);
    setFormData({ name: '', type: 'mcp', description: '', configData: {} });
    setMcpConfig({ url: '', headers: [{ key: '', value: '' }] });
    setPluginConfig({ pluginKey: '', instanceId: '' });
    setSkillConfig({ content: '', fileType: 'markdown', fileName: '' });
    setParsedSkill(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入工具名称');
      return;
    }

    setIsSubmitting(true);

    try {
      const configData: Record<string, unknown> = {};

      if (formData.type === 'mcp') {
        configData.url = mcpConfig.url;
        configData.headers = mcpConfig.headers.filter(h => h.key.trim() !== '');
      } else if (formData.type === 'cloud_plugin') {
        configData.pluginKey = pluginConfig.pluginKey;
        configData.instanceId = pluginConfig.instanceId;
      }

      if (editingTool) {
        // 更新请求
        const skillData = formData.type === 'skill' ? {
          name: parsedSkill?.name || formData.name,
          description: parsedSkill?.description || formData.description,
          content: skillConfig.content,
          fileType: skillConfig.fileType,
          inputSchema: parsedSkill?.inputSchema,
          outputSchema: parsedSkill?.outputSchema,
          examples: parsedSkill?.examples,
          metadata: parsedSkill?.metadata,
          version: parsedSkill?.version,
        } : undefined;
        const updateRequest: UpdateToolRequest = {
          name: formData.name,
          description: formData.description,
          configData,
          skillData,
        };
        await updateTool(editingTool.id, updateRequest);
        toast.success('工具更新成功');
      } else {
        // 创建请求
        const skillData = formData.type === 'skill' ? {
          name: parsedSkill?.name || formData.name,
          description: parsedSkill?.description || formData.description,
          content: skillConfig.content,
          fileType: skillConfig.fileType,
          inputSchema: parsedSkill?.inputSchema,
          outputSchema: parsedSkill?.outputSchema,
          examples: parsedSkill?.examples,
          metadata: parsedSkill?.metadata,
          version: parsedSkill?.version,
        } : undefined;
        const createRequest: CreateToolRequest = {
          name: formData.name,
          type: formData.type,
          description: formData.description,
          configData,
          skillData,
        };
        await createTool(createRequest);
        toast.success('工具创建成功');
      }

      handleCloseDialog();
      fetchTools();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error || '未知错误');
      logger.error('保存工具失败', errorMessage);
      toast.error(`${editingTool ? '更新' : '创建'}工具失败: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定要删除这个工具吗？')) return;

    try {
      await deleteTool(id);
      toast.success('工具删除成功');
      fetchTools();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error || '未知错误');
      logger.error('删除工具失败', errorMessage);
      toast.error(`删除工具失败: ${errorMessage}`);
    }
  };

  const handleToggleActive = async (tool: Tool) => {
    try {
      await updateTool(tool.id, { isActive: !tool.isActive });
      toast.success(tool.isActive ? '工具已禁用' : '工具已启用');
      fetchTools();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error || '未知错误');
      logger.error('切换工具状态失败', errorMessage);
      toast.error(`操作失败: ${errorMessage}`);
    }
  };

  const handleTestConnection = async (tool: Tool) => {
    setTestingConnection(tool.id);
    try {
      const result = await testToolConnection(tool.id);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error || '未知错误');
      logger.error('测试工具连接失败', errorMessage);
      toast.error(`测试连接失败: ${errorMessage}`);
    } finally {
      setTestingConnection(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工具管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理 MCP 和云端插件，Agent 和 Workflow 均可调用</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          添加工具
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索工具..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="mcp">MCP</SelectItem>
            <SelectItem value="cloud_plugin">云端插件</SelectItem>
            <SelectItem value="skill">Skill</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : filteredTools.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchKeyword || filterType !== 'all' ? '未找到匹配的工具' : '暂无工具，点击添加按钮创建'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <Card key={tool.id} className={`p-4 ${!tool.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    tool.type === 'mcp' ? 'bg-blue-100 text-blue-600' : 
                    tool.type === 'cloud_plugin' ? 'bg-purple-100 text-purple-600' : 
                    'bg-green-100 text-green-600'
                  }`}>
                    {tool.type === 'mcp' ? <Server className="h-5 w-5" /> : 
                     tool.type === 'cloud_plugin' ? <Cloud className="h-5 w-5" /> : 
                     <Sparkles className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{tool.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tool.type === 'mcp' ? 'bg-blue-100 text-blue-600' : 
                      tool.type === 'cloud_plugin' ? 'bg-purple-100 text-purple-600' : 
                      'bg-green-100 text-green-600'
                    }`}>
                      {tool.type === 'mcp' ? 'MCP' : tool.type === 'cloud_plugin' ? '云端插件' : 'Skill'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(tool)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {tool.isActive ? (
                    <ToggleRight className="h-6 w-6 text-green-600" />
                  ) : (
                    <ToggleLeft className="h-6 w-6" />
                  )}
                </button>
              </div>

              {tool.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{tool.description}</p>
              )}

              <div className="flex items-center gap-2 pt-3 border-t">
                <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(tool)} className="gap-1">
                  <Pencil className="h-3 w-3" />
                  编辑
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(tool.id)} className="gap-1 text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                  删除
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DraggableDialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTool ? '编辑工具' : '添加工具'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>工具名称 <span className="text-destructive">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入工具名称"
              />
            </div>

            <div className="space-y-2">
              <Label>工具类型</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'mcp' | 'cloud_plugin' | 'skill') => {
                  setFormData({ ...formData, type: value });
                  setParsedSkill(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcp">MCP</SelectItem>
                  <SelectItem value="cloud_plugin">云端插件</SelectItem>
                  <SelectItem value="skill">Skill</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>描述</Label>
              <Input
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="请输入工具描述（可选）"
              />
            </div>

            {formData.type === 'mcp' ? (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-medium">MCP 配置</h4>
                <div className="space-y-2">
                  <Label>插件 URL</Label>
                  <Input
                    value={mcpConfig.url}
                    onChange={(e) => setMcpConfig({ ...mcpConfig, url: e.target.value })}
                    placeholder="例如: https://api.example.com/mcp"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Headers</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addHeader} className="h-6 px-2 text-xs">
                      + 添加
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {mcpConfig.headers.map((header, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={header.key}
                          onChange={(e) => updateHeader(index, 'key', e.target.value)}
                          placeholder="Key"
                          className="flex-1"
                        />
                        <Input
                          value={header.value}
                          onChange={(e) => updateHeader(index, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1"
                        />
                        {mcpConfig.headers.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeHeader(index)}
                            className="h-8 w-8 shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : formData.type === 'skill' ? (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-medium">Skill 配置</h4>
                
                {/* 文件上传区 */}
                <div className="space-y-2">
                  <Label>上传 Skill 文件</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.markdown,.zip"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      uploadingFile ? 'border-primary bg-accent/50' : 'border-border hover:border-primary hover:bg-accent/30'
                    }`}
                  >
                    {uploadingFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <span className="text-sm text-muted-foreground">正在解析文件...</span>
                      </div>
                    ) : parsedSkill ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 text-green-600" />
                        <span className="text-sm font-medium">{skillConfig.fileName}</span>
                        <span className="text-xs text-muted-foreground">点击重新上传</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          点击上传 .md, .markdown 或 .zip 文件
                        </span>
                        <span className="text-xs text-muted-foreground">
                          文件将自动解析生成输入输出 Schema
                        </span>
                      </div>
                    )}
                  </div>
                  {parsedSkill && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSkillConfig({ content: '', fileType: 'markdown', fileName: '' });
                        setParsedSkill(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-1" />
                      清除文件
                    </Button>
                  )}
                </div>

                {/* 解析结果展示 */}
                {parsedSkill && (
                  <div className="space-y-4 bg-accent/30 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">解析结果</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">名称</span>
                        <span className="text-sm font-medium">{parsedSkill.name}</span>
                      </div>
                      {parsedSkill.description && (
                        <div>
                          <span className="text-sm text-muted-foreground">描述</span>
                          <p className="text-sm mt-1">{parsedSkill.description}</p>
                        </div>
                      )}
                      {parsedSkill.version && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">版本</span>
                          <span className="text-sm">{parsedSkill.version}</span>
                        </div>
                      )}
                      
                      {parsedSkill.inputSchema && parsedSkill.inputSchema.length > 0 && (
                        <div>
                          <span className="text-sm text-muted-foreground">输入参数</span>
                          <div className="mt-2 space-y-2">
                            {parsedSkill.inputSchema.map((param, index) => (
                              <div key={index} className="bg-card rounded p-2 text-xs">
                                <span className="font-mono font-medium">{param.name}</span>
                                <span className="text-muted-foreground ml-2">({param.type})</span>
                                {param.required && <span className="text-destructive ml-1">*</span>}
                                {param.description && <p className="text-muted-foreground mt-1">{param.description}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {parsedSkill.outputSchema && parsedSkill.outputSchema.length > 0 && (
                        <div>
                          <span className="text-sm text-muted-foreground">输出参数</span>
                          <div className="mt-2 space-y-2">
                            {parsedSkill.outputSchema.map((param, index) => (
                              <div key={index} className="bg-card rounded p-2 text-xs">
                                <span className="font-mono font-medium">{param.name}</span>
                                <span className="text-muted-foreground ml-2">({param.type})</span>
                                {param.description && <p className="text-muted-foreground mt-1">{param.description}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {parsedSkill.metadata && (
                        <div className="flex items-center gap-4 flex-wrap">
                          {parsedSkill.metadata.author && (
                            <span className="text-xs text-muted-foreground">
                              作者: {parsedSkill.metadata.author}
                            </span>
                          )}
                          {parsedSkill.metadata.category && (
                            <span className="text-xs text-muted-foreground">
                              分类: {parsedSkill.metadata.category}
                            </span>
                          )}
                          {parsedSkill.metadata.tags && parsedSkill.metadata.tags.length > 0 && (
                            <div className="flex gap-1">
                              {parsedSkill.metadata.tags.map((tag, idx) => (
                                <span key={idx} className="text-xs bg-accent px-2 py-0.5 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {!parsedSkill && (
                  <p className="text-xs text-muted-foreground">
                    请上传 Skill 文件以获取更多信息
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-medium">云端插件配置</h4>
                <div className="space-y-2">
                  <Label>插件 Key</Label>
                  <Input
                    value={pluginConfig.pluginKey}
                    onChange={(e) => setPluginConfig({ ...pluginConfig, pluginKey: e.target.value })}
                    placeholder="请输入插件 Key"
                  />
                </div>
                <div className="space-y-2">
                  <Label>插件实例 ID</Label>
                  <Input
                    value={pluginConfig.instanceId}
                    onChange={(e) => setPluginConfig({ ...pluginConfig, instanceId: e.target.value })}
                    placeholder="请输入插件实例 ID"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {editingTool && (
              <Button
                variant="outline"
                onClick={() => editingTool && handleTestConnection(editingTool)}
                disabled={testingConnection === editingTool?.id}
                className="gap-1 mr-auto"
              >
                {testingConnection === editingTool?.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                测试连接
              </Button>
            )}
            <Button variant="outline" onClick={handleCloseDialog}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : editingTool ? '更新' : '创建'}
            </Button>
          </DialogFooter>
        </DraggableDialogContent>
      </Dialog>
    </div>
  );
};

export default ToolPage;
