import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Users, Shield, X, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DraggableDialogContent } from '@/components/ui/draggable-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getOrganizationList,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationPermissions,
  grantResourcePermission,
  revokeResourcePermission,
  getAgentList,
  getWorkflowList,
  getToolList,
  getKnowledgeBaseList,
} from '@/api/index';
import type {
  Organization,
  OrganizationResourcePermission,
  PermissionType,
  LevelType,
} from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { showConfirm } from '@lark-apaas/client-toolkit';

const PERMISSION_TYPES: { value: PermissionType; label: string }[] = [
  { value: 'agent', label: 'Agent' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'tool', label: '工具' },
  { value: 'knowledge', label: '知识库' },
];

const LEVEL_TYPES: { value: LevelType | 'all'; label: string }[] = [
  { value: 'management', label: '管理层' },
  { value: 'normal', label: '普通层' },
  { value: 'all', label: '全部层级' },
];

const INITIAL_ORGANIZATIONS = [
  { name: '运营', description: '负责产品运营和市场推广' },
  { name: '开发', description: '负责产品开发和维护' },
  { name: '美工', description: '负责设计和视觉' },
  { name: '财务', description: '负责财务和预算管理' },
  { name: '供应链', description: '负责供应链和物流管理' },
];

const OrganizationManageTab: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const [permissions, setPermissions] = useState<OrganizationResourcePermission[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([]);
  const [tools, setTools] = useState<{ id: string; name: string }[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<{ id: string; name: string }[]>([]);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
  }>({
    name: '',
    description: '',
  });

  const [permissionForm, setPermissionForm] = useState<{
    resourceType: PermissionType | '';
    resourceIds: string[];
    levelType: LevelType | 'all' | '';
  }>({
    resourceType: '',
    resourceIds: [],
    levelType: '',
  });

  useEffect(() => {
    fetchOrganizations();
    fetchResources();
  }, []);

  const fetchOrganizations = async () => {
    setIsLoading(true);
    try {
      const resp = await getOrganizationList();
      setOrganizations(resp.items);
      // 检查是否已初始化
      if (resp.items.length === 0 && !isInitialized) {
        await initializeOrganizations();
      }
    } catch (error) {
      logger.error('获取组织列表失败', error);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeOrganizations = async () => {
    try {
      for (const org of INITIAL_ORGANIZATIONS) {
        await createOrganization(org);
      }
      setIsInitialized(true);
      await fetchOrganizations();
    } catch (error) {
      logger.error('初始化组织失败', error);
    }
  };

  const fetchResources = async () => {
    try {
      const [agentResp, workflowResp, toolResp, kbResp] = await Promise.all([
        getAgentList().catch(() => ({ items: [] })),
        getWorkflowList().catch(() => ({ items: [] })),
        getToolList().catch(() => []),
        getKnowledgeBaseList().catch(() => ({ items: [] })),
      ]);
      setAgents(agentResp.items.map((a) => ({ id: a.id, name: a.name })));
      setWorkflows(workflowResp.items.map((w) => ({ id: w.id, name: w.name })));
      const toolItems = Array.isArray(toolResp) ? toolResp : [];
      setTools(toolItems.filter((t) => t.isActive).map((t) => ({ id: t.id, name: t.name })));
      setKnowledgeBases(kbResp.items.map((k) => ({ id: k.id, name: k.name })));
    } catch (error) {
      logger.error('获取资源列表失败', error);
    }
  };

  const fetchPermissions = async (orgId: string) => {
    try {
      const resp = await getOrganizationPermissions(orgId);
      setPermissions(resp.items);
    } catch (error) {
      logger.error('获取权限列表失败', error);
    }
  };

  const handleAdd = () => {
    setEditingOrg(null);
    setFormData({
      name: '',
      description: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      description: org.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await showConfirm('确定要删除该组织吗？'))) return;
    try {
      await deleteOrganization(id);
      await fetchOrganizations();
    } catch (error) {
      logger.error('删除组织失败', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingOrg) {
        await updateOrganization(editingOrg.id, formData);
      } else {
        await createOrganization(formData);
      }
      setIsDialogOpen(false);
      await fetchOrganizations();
    } catch (error) {
      logger.error('保存组织失败', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManagePermissions = async (org: Organization) => {
    setSelectedOrg(org);
    await fetchPermissions(org.id);
    setPermissionForm({
      resourceType: '',
      resourceIds: [],
      levelType: '',
    });
    setIsPermissionDialogOpen(true);
  };

  const handleGrantPermission = async () => {
    if (!selectedOrg || !permissionForm.resourceType || permissionForm.resourceIds.length === 0 || !permissionForm.levelType) {
      return;
    }

    try {
      // 批量授权
      await Promise.all(
        permissionForm.resourceIds.map((resourceId) =>
          grantResourcePermission(selectedOrg.id, {
            resourceType: permissionForm.resourceType as PermissionType,
            resourceId,
            levelType: permissionForm.levelType as LevelType | 'all',
          })
        )
      );
      await fetchPermissions(selectedOrg.id);
      setPermissionForm({
        resourceType: '',
        resourceIds: [],
        levelType: '',
      });
    } catch (error) {
      logger.error('授予权限失败', error);
    }
  };

  const handleRevokePermission = async (permissionId: string) => {
    if (!selectedOrg) return;
    try {
      await revokeResourcePermission(selectedOrg.id, permissionId);
      await fetchPermissions(selectedOrg.id);
    } catch (error) {
      logger.error('撤销权限失败', error);
    }
  };

  const getResourceOptions = (type: PermissionType | '') => {
    switch (type) {
      case 'agent':
        return agents;
      case 'workflow':
        return workflows;
      case 'tool':
        return tools;
      case 'knowledge':
        return knowledgeBases;
      default:
        return [];
    }
  };

  const getResourceName = (type: PermissionType, id: string) => {
    const options = getResourceOptions(type);
    return options.find((o) => o.id === id)?.name || id;
  };

  const getPermissionTypeLabel = (type: PermissionType) => {
    return PERMISSION_TYPES.find((p) => p.value === type)?.label || type;
  };

  const getLevelTypeLabel = (type: LevelType | 'all') => {
    return LEVEL_TYPES.find((l) => l.value === type)?.label || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">组织管理</h3>
          <p className="text-sm text-muted-foreground">
            管理组织架构，为不同组织和层级分配资源权限
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          添加组织
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : organizations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无组织，点击上方按钮添加</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {organizations.map((org) => (
            <Card key={org.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{org.name}</CardTitle>
                      {org.description && (
                        <p className="text-sm text-muted-foreground">{org.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleManagePermissions(org)}>
                      <Shield className="h-4 w-4 mr-1" />
                      权限管理
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(org)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(org.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* 组织编辑对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DraggableDialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOrg ? '编辑组织' : '添加组织'}</DialogTitle>
            <DialogDescription>配置组织信息</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">组织名称 *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入组织名称"
              />
            </div>
            <div>
              <label className="text-sm font-medium">描述</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="输入组织描述"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !formData.name.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DraggableDialogContent>
      </Dialog>

      {/* 权限管理对话框 */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DraggableDialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>资源权限管理 - {selectedOrg?.name}</DialogTitle>
            <DialogDescription>为该组织的不同层级分配资源访问权限</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* 添加权限表单 */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                <h4 className="text-sm font-medium">添加资源授权</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">资源类型</label>
                    <Select
                      value={permissionForm.resourceType}
                      onValueChange={(value: PermissionType) =>
                        setPermissionForm({ ...permissionForm, resourceType: value, resourceIds: [] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {PERMISSION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      资源 ({permissionForm.resourceIds.length} 已选)
                    </label>
                    <div className="border rounded-md p-2 max-h-[120px] overflow-y-auto bg-background">
                      {permissionForm.resourceType ? (
                        getResourceOptions(permissionForm.resourceType).map((resource) => (
                          <label
                            key={resource.id}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={permissionForm.resourceIds.includes(resource.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPermissionForm({
                                    ...permissionForm,
                                    resourceIds: [...permissionForm.resourceIds, resource.id],
                                  });
                                } else {
                                  setPermissionForm({
                                    ...permissionForm,
                                    resourceIds: permissionForm.resourceIds.filter((id) => id !== resource.id),
                                  });
                                }
                              }}
                              className="rounded border-border"
                            />
                            <span className="text-sm truncate">{resource.name}</span>
                          </label>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground px-2 py-1">请先选择资源类型</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">授权层级</label>
                    <Select
                      value={permissionForm.levelType}
                      onValueChange={(value: LevelType | 'all') =>
                        setPermissionForm({ ...permissionForm, levelType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择层级" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVEL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleGrantPermission}
                  disabled={
                    !permissionForm.resourceType ||
                    permissionForm.resourceIds.length === 0 ||
                    !permissionForm.levelType
                  }
                  className="w-full"
                >
                  <Check className="h-4 w-4 mr-2" />
                  添加授权
                </Button>
              </div>

              {/* 权限列表 */}
              <div>
                <h4 className="text-sm font-medium mb-3">已授权资源</h4>
                {permissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    暂无授权资源
                  </p>
                ) : (
                  <div className="space-y-2">
                    {permissions.map((perm) => (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between p-3 bg-card border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{getPermissionTypeLabel(perm.resourceType)}</Badge>
                          <span className="font-medium">
                            {getResourceName(perm.resourceType, perm.resourceId)}
                          </span>
                          <Badge variant="secondary">{getLevelTypeLabel(perm.levelType)}</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevokePermission(perm.id)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DraggableDialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizationManageTab;
