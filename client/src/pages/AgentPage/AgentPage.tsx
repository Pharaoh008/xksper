import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Plus, Search, MoreHorizontal, Pencil, Trash2, Power, PowerOff, BookOpen, Wrench, Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import { DraggableDialogContent } from '@/components/ui/draggable-dialog';
import { getAgentList, deleteAgent, updateAgent, getKnowledgeBaseList, getConfigStatus, getToolList, createKnowledgeBase, uploadDocumentToKnowledgeBase, getOrganizationList } from '@/api';
import type { AgentConfig, CreateKnowledgeBaseRequest, UploadDocumentRequest, Organization } from '@shared/api.interface';
import type { Tool } from '@/api';
import { uploadFile } from '@/components/business-ui/api/files/service';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { LlmModel, ModelPricing } from '@shared/api.interface';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { showConfirm } from '@lark-apaas/client-toolkit';

import type { KnowledgeBase } from '@shared/api.interface';

interface AgentFormData {
  name: string;
  description: string;
  instruction: string;
  greeting: string;
  model: string;
  knowledgeBase: string[];
  tools: string[];
}

interface PendingDocument {
  file: File;
  filePath: string;
  uploading: boolean;
}

const AgentFormDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editAgent?: AgentConfig | null;
}> = ({ open, onOpenChange, onSuccess, editAgent }) => {
  const [models, setModels] = useState<ModelPricing[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newDocs: PendingDocument[] = [];
    for (const file of Array.from(files)) {
      newDocs.push({
        file,
        filePath: '',
        uploading: true,
      });
    }
    setPendingDocuments((prev) => [...prev, ...newDocs]);

    // 上传文件到云存储
    for (let i = 0; i < newDocs.length; i++) {
      const doc = newDocs[i];
      try {
        const result = await uploadFile(doc.file);
        setPendingDocuments((prev) => {
          const updated = [...prev];
          const idx = prev.findIndex((d) => d.file === doc.file);
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              filePath: result.filePath,
              uploading: false,
            };
          }
          return updated;
        });
      } catch (error) {
        logger.error('上传文件失败', error);
        setPendingDocuments((prev) => prev.filter((d) => d.file !== doc.file));
      }
    }
  };

  // 移除待上传文档
  const removePendingDocument = (file: File) => {
    setPendingDocuments((prev) => prev.filter((d) => d.file !== file));
  };

  useEffect(() => {
    Promise.all([
      getConfigStatus(),
      getKnowledgeBaseList(),
      getToolList(),
      getOrganizationList(),
    ]).then(([configData, kbData, toolData, orgData]) => {
      const enabledModels = configData.availableModels.filter((model: ModelPricing) =>
        configData.enabledModels.includes(model.id)
      );
      setModels(enabledModels);
      setKnowledgeBases(kbData.items);
      setOrganizations(orgData.items);
      setTools((toolData || []).filter((t) => t.isActive));
    }).catch(console.error);
  }, []);

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

  useEffect(() => {
    if (open && editAgent) {
      form.reset({
        name: editAgent.name,
        description: editAgent.description || '',
        instruction: editAgent.instruction || '',
        greeting: editAgent.greeting || '',
        model: editAgent.model || '',
        knowledgeBase: editAgent.knowledgeBase || [],
        tools: editAgent.tools || [],
      });
    } else if (open) {
      form.reset({
        name: '',
        description: '',
        instruction: '',
        greeting: '',
        model: '',
        knowledgeBase: [],
        tools: [],
      });
    }
  }, [open, editAgent, form]);

  const onSubmit = async (data: AgentFormData) => {
    setLoading(true);
    try {
      const { createAgent, updateAgent } = await import('@/api');
      
      // 处理待上传的文档
      let knowledgeBaseIds = [...data.knowledgeBase];
      if (pendingDocuments.length > 0) {
        // 创建新的知识库（使用Agent名称）
        const kbData: CreateKnowledgeBaseRequest = {
          name: `${data.name}的知识库`,
          description: `自动为Agent "${data.name}" 创建的知识库`,
          type: 'local',
        };
        const newKb = await createKnowledgeBase(kbData);
        knowledgeBaseIds.push(newKb.id);

        // 上传文档到知识库
        const uploadedDocs = pendingDocuments.filter((d) => d.filePath && !d.uploading);
        for (const doc of uploadedDocs) {
          try {
            await uploadDocumentToKnowledgeBase(newKb.id, {
              name: doc.file.name,
              filePath: doc.filePath,
              fileSize: doc.file.size,
              fileType: doc.file.type,
            });
          } catch (error) {
            logger.error('上传文档到知识库失败', error);
          }
        }
      }
      
      const agentData = {
        ...data,
        knowledgeBase: knowledgeBaseIds,
      };
      
      if (editAgent) {
        await updateAgent(editAgent.id, agentData);
      } else {
        await createAgent(agentData);
      }
      
      // 清空待上传文档
      setPendingDocuments([]);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      logger.error('保存Agent失败', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DraggableDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editAgent ? '编辑 Agent' : '创建 Agent'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: '请输入Agent名称' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名称</FormLabel>
                  <FormControl>
                    <Input placeholder="输入Agent名称" {...field} />
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
                    <Input placeholder="输入Agent描述" {...field} />
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
                  <FormLabel>选择模型</FormLabel>
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

            <FormField
              control={form.control}
              name="knowledgeBase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>关联知识库</FormLabel>
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
                        
                        // 获取已选知识库的名称映射
                        const getSelectedKBNames = () => {
                          return (field.value || []).map((id: string) => {
                            const kb = knowledgeBases.find(k => k.id === id);
                            return kb ? { id: kb.id, name: kb.name, orgId: kb.organizationId || 'global' } : null;
                          }).filter(Boolean) as { id: string; name: string; orgId: string }[];
                        };
                        
                        const toggleKB = (kbId: string) => {
                          if (field.value?.includes(kbId)) {
                            field.onChange(field.value.filter((id: string) => id !== kbId));
                          } else {
                            field.onChange([...(field.value || []), kbId]);
                          }
                        };
                        
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
                                    const isSelected = field.value?.includes(kb.id);
                                    return (
                                      <Button
                                        key={kb.id}
                                        type="button"
                                        variant={isSelected ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => toggleKB(kb.id)}
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
                                          onClick={() => toggleKB(kb.id)}
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

            <FormField
              control={form.control}
              name="tools"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>接入工具</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {tools.map((tool) => {
                        const isSelected = field.value?.includes(tool.id);
                        return (
                          <Button
                            key={tool.id}
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              if (isSelected) {
                                field.onChange(field.value.filter((id: string) => id !== tool.id));
                              } else {
                                field.onChange([...(field.value || []), tool.id]);
                              }
                            }}
                          >
                            <Wrench className="h-4 w-4 mr-1" />
                            {tool.name}
                          </Button>
                        );
                      })}
                      {tools.length === 0 && (
                        <span className="text-sm text-muted-foreground">暂无工具，请先创建工具</span>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 文件上传 */}
            <FormItem>
              <FormLabel>上传文档到知识库</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.md,.json"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    选择文档上传
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    支持 PDF、Word、TXT、Markdown、JSON 等格式，将自动创建知识库并关联
                  </p>
                  
                  {/* 待上传文档列表 */}
                  {pendingDocuments.length > 0 && (
                    <div className="space-y-2">
                      {pendingDocuments.map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-accent rounded-md"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="text-sm truncate">{doc.file.name}</span>
                            {doc.uploading && (
                              <span className="text-xs text-muted-foreground">上传中...</span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => removePendingDocument(doc.file)}
                            disabled={doc.uploading}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FormControl>
            </FormItem>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </Form>
      </DraggableDialogContent>
    </Dialog>
  );
};

const AgentListPage: React.FC = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentConfig | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAgentList();
      setAgents(data.items);
    } catch (error) {
      logger.error('获取Agent列表失败', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleEdit = (agent: AgentConfig) => {
    setEditAgent(agent);
    setDialogOpen(true);
  };

  const handleChat = (agentId: string) => {
    navigate(`/agent/${agentId}`);
  };

  const handleCreate = () => {
    setEditAgent(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定要删除这个Agent吗？')) return;
    try {
      await deleteAgent(id);
      fetchAgents();
    } catch (error) {
      logger.error('删除Agent失败', error);
    }
  };

  const handleToggleActive = async (agent: AgentConfig) => {
    try {
      await updateAgent(agent.id, { isActive: !agent.isActive });
      fetchAgents();
    } catch (error) {
      logger.error('切换Agent状态失败', error);
    }
  };

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agent</h1>
          <p className="text-muted-foreground text-sm mt-1">管理和配置你的AI Agent</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          创建 Agent
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索 Agent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">还没有 Agent，点击右上角创建</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-ai-section-type="card-menu">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className={`cursor-pointer hover:border-primary/50 transition-colors ${!agent.isActive ? 'opacity-60' : ''}`}
              onClick={() => handleChat(agent.id)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    <Badge variant={agent.isActive ? 'default' : 'secondary'} className="mt-1">
                      {agent.isActive ? '启用' : '禁用'}
                    </Badge>
                  </div>
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
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleChat(agent.id); }}>
                      <Bot className="h-4 w-4 mr-2" />
                      应用
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(agent); }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleActive(agent); }}>
                      {agent.isActive ? (
                        <>
                          <PowerOff className="h-4 w-4 mr-2" />
                          禁用
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4 mr-2" />
                          启用
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(agent.id); }} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {agent.description || '暂无描述'}
                </p>
                {agent.model && (
                  <Badge variant="outline" className="mt-3 font-mono text-xs">
                    {agent.model}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AgentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchAgents}
        editAgent={editAgent}
      />
    </div>
  );
};

export default AgentListPage;
