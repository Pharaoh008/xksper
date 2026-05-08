import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, BookOpen, Wrench, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import type { AgentConfig, KnowledgeBase, ModelPricing, Organization } from '@shared/api.interface';
import type { Tool } from '@/api';
import { getAgent, updateAgent, getKnowledgeBaseList, getToolList, getConfigStatus, getOrganizationList } from '@/api';

interface AgentFormData {
  name: string;
  description: string;
  instruction: string;
  greeting: string;
  model: string;
  knowledgeBase: string[];
  tools: string[];
}

const AgentEditPage: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [models, setModels] = useState<ModelPricing[]>([]);

  const form = useForm<AgentFormData>({
    defaultValues: {
      name: '',
      description: '',
      instruction: '',
      greeting: '',
      model: '',
      knowledgeBase: [],
      tools: [],
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!agentId) return;
      try {
        setLoading(true);
        const [agentData, kbData, toolData, configData, orgData] = await Promise.all([
          getAgent(agentId),
          getKnowledgeBaseList(),
          getToolList(),
          getConfigStatus(),
          getOrganizationList(),
        ]);

        setAgent(agentData);
        setKnowledgeBases(kbData.items);
        setOrganizations(orgData.items);
        setTools(toolData.filter((t: Tool) => t.isActive));
        
        const enabledModels = configData.availableModels.filter((model: ModelPricing) =>
          configData.enabledModels.includes(model.id)
        );
        setModels(enabledModels);

        if (agentData) {
          form.reset({
            name: agentData.name,
            description: agentData.description || '',
            instruction: agentData.instruction || '',
            greeting: agentData.greeting || '',
            model: agentData.model || '',
            knowledgeBase: agentData.knowledgeBase || [],
            tools: agentData.tools || [],
          });
        }
      } catch (error) {
        logger.error('获取Agent数据失败', error);
        toast.error('获取Agent数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [agentId, form]);

  const onSubmit = async (data: AgentFormData) => {
    if (!agentId) return;
    setSaving(true);
    try {
      await updateAgent(agentId, data);
      toast.success('保存成功');
      navigate('/agent');
    } catch (error) {
      logger.error('保存Agent失败', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const toggleKnowledgeBase = (kbId: string) => {
    const current = form.getValues('knowledgeBase') || [];
    if (current.includes(kbId)) {
      form.setValue('knowledgeBase', current.filter((id) => id !== kbId));
    } else {
      form.setValue('knowledgeBase', [...current, kbId]);
    }
  };

  // 按组织分组知识库
  const getKnowledgeBasesByOrg = () => {
    const grouped: Record<string, KnowledgeBase[]> = {};
    
    // 全局知识库（无组织ID）
    const globalKbs = knowledgeBases.filter(kb => !kb.organizationId);
    if (globalKbs.length > 0) {
      grouped['global'] = globalKbs;
    }
    
    // 按组织分组
    organizations.forEach(org => {
      const orgKbs = knowledgeBases.filter(kb => kb.organizationId === org.id);
      if (orgKbs.length > 0) {
        grouped[org.id] = orgKbs;
      }
    });
    
    return grouped;
  };

  const getOrgName = (orgId: string) => {
    if (orgId === 'global') return '全局';
    return organizations.find(o => o.id === orgId)?.name || '未知组织';
  };

  // 获取有知识库的组织ID列表
  const getOrgIdsWithKBs = () => {
    const grouped = getKnowledgeBasesByOrg();
    return Object.keys(grouped);
  };

  // 获取当前选中组织下的知识库
  const getCurrentOrgKBs = () => {
    const grouped = getKnowledgeBasesByOrg();
    return selectedOrgId ? grouped[selectedOrgId] || [] : [];
  };

  // 获取已选知识库的名称映射
  const getSelectedKBNames = () => {
    const selectedIds = form.watch('knowledgeBase') || [];
    return selectedIds.map(id => {
      const kb = knowledgeBases.find(k => k.id === id);
      return kb ? { id: kb.id, name: kb.name, orgId: kb.organizationId || 'global' } : null;
    }).filter(Boolean) as { id: string; name: string; orgId: string }[];
  };

  const toggleTool = (toolId: string) => {
    const current = form.getValues('tools') || [];
    if (current.includes(toolId)) {
      form.setValue('tools', current.filter((id) => id !== toolId));
    } else {
      form.setValue('tools', [...current, toolId]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Agent不存在或已被删除</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/agent')}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/agent')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">编辑 Agent</h1>
            <p className="text-sm text-muted-foreground">配置智能体的基本信息、知识库和工具</p>
          </div>
        </div>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                rules={{ required: '请输入名称' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称</FormLabel>
                    <FormControl>
                      <Input placeholder="Agent名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Input placeholder="简要描述Agent的用途" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模型</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        {...field}
                      >
                        <option value="">选择模型</option>
                        {models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instruction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>指令</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="定义Agent的行为规则和角色设定"
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="greeting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>开场白</FormLabel>
                    <FormControl>
                      <Input placeholder="用户开始对话时的问候语" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 知识库绑定 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                关联知识库
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="knowledgeBase"
                render={() => (
                  <FormItem>
                    <FormControl>
                      <div className="space-y-4">
                        {(() => {
                          const orgIds = getOrgIdsWithKBs();
                          
                          if (orgIds.length === 0) {
                            return (
                              <span className="text-sm text-muted-foreground">
                                暂无知识库，请先创建知识库
                              </span>
                            );
                          }
                          
                          return (
                            <>
                              {/* 第一步：选择组织 */}
                              <div className="space-y-2">
                                <span className="text-sm font-medium">1. 选择组织</span>
                                <div className="flex flex-wrap gap-2">
                                  {orgIds.map(orgId => (
                                    <Button
                                      key={orgId}
                                      type="button"
                                      variant={selectedOrgId === orgId ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => setSelectedOrgId(orgId)}
                                    >
                                      {getOrgName(orgId)}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                              
                              {/* 第二步：选择知识库 */}
                              {selectedOrgId && (
                                <div className="space-y-2">
                                  <span className="text-sm font-medium">
                                    2. 选择「{getOrgName(selectedOrgId)}」的知识库（可多选）
                                  </span>
                                  <div className="flex flex-wrap gap-2">
                                    {getCurrentOrgKBs().map((kb) => {
                                      const selected = form.watch('knowledgeBase')?.includes(kb.id);
                                      return (
                                        <Button
                                          key={kb.id}
                                          type="button"
                                          variant={selected ? 'default' : 'outline'}
                                          size="sm"
                                          onClick={() => toggleKnowledgeBase(kb.id)}
                                        >
                                          <BookOpen className="h-4 w-4 mr-1" />
                                          {kb.name}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              
                              {/* 已选知识库汇总 */}
                              {(() => {
                                const selectedKBs = getSelectedKBNames();
                                if (selectedKBs.length === 0) return null;
                                return (
                                  <div className="space-y-2 pt-2 border-t">
                                    <span className="text-sm font-medium">已选知识库</span>
                                    <div className="flex flex-wrap gap-2">
                                      {selectedKBs.map(kb => (
                                        <Badge key={kb.id} variant="secondary" className="gap-1">
                                          <BookOpen className="h-3 w-3" />
                                          {getOrgName(kb.orgId)} / {kb.name}
                                          <button
                                            type="button"
                                            onClick={() => toggleKnowledgeBase(kb.id)}
                                            className="ml-1 hover:text-destructive"
                                          >
                                            ×
                                          </button>
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </>
                          );
                        })()}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 工具绑定 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                关联工具
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="tools"
                render={() => (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-wrap gap-2">
                        {tools.map((tool) => {
                          const selected = form.watch('tools')?.includes(tool.id);
                          return (
                            <Button
                              key={tool.id}
                              type="button"
                              variant={selected ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => toggleTool(tool.id)}
                            >
                              <Wrench className="h-4 w-4 mr-1" />
                              {tool.name}
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {tool.type}
                              </Badge>
                            </Button>
                          );
                        })}
                        {tools.length === 0 && (
                          <span className="text-sm text-muted-foreground">
                            暂无可用工具，请先创建工具
                          </span>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/agent')}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AgentEditPage;
