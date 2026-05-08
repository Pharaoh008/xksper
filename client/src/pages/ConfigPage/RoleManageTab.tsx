import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, User, Phone, Building2, Shield, X, Loader2, Users } from 'lucide-react';
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
import { getRoleList, createRole, updateRole, deleteRole, getAgentList, getWorkflowList, getToolList, getKnowledgeBaseList, getOrganizationList, getOrganizationPermissions } from '@/api/index';
import type { Role, CreateRoleRequest, UpdateRoleRequest, PermissionType, Organization, LevelType } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { showConfirm } from '@lark-apaas/client-toolkit';

const PERMISSION_TYPES: { value: PermissionType; label: string }[] = [
  { value: 'agent', label: 'Agent' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'tool', label: '工具' },
  { value: 'knowledge', label: '知识库' },
];

const LEVEL_TYPES: { value: LevelType; label: string }[] = [
  { value: 'management', label: '管理层' },
  { value: 'normal', label: '普通层' },
];

const RoleManageTab: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([]);
  const [tools, setTools] = useState<{ id: string; name: string }[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<{ id: string; name: string }[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [formData, setFormData] = useState<{
    userName: string;
    phone: string;
    department: string;
    organizationId: string;
    levelType: LevelType | '';
  }>({
    userName: '',
    phone: '',
    department: '',
    organizationId: '',
    levelType: '',
  });

  useEffect(() => {
    fetchRoles();
    fetchResources();
  }, []);

  const fetchRoles = async () => {
    setIsLoading(true);
    try {
      const resp = await getRoleList();
      setRoles(resp.items);
    } catch (error) {
      logger.error('获取角色列表失败', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      const [agentResp, workflowResp, toolResp, kbResp, orgResp] = await Promise.all([
        getAgentList().catch(() => ({ items: [] })),
        getWorkflowList().catch(() => ({ items: [] })),
        getToolList().catch(() => []),
        getKnowledgeBaseList().catch(() => ({ items: [] })),
        getOrganizationList().catch(() => ({ items: [] })),
      ]);
      setAgents(agentResp.items.map((a) => ({ id: a.id, name: a.name })));
      setWorkflows(workflowResp.items.map((w) => ({ id: w.id, name: w.name })));
      const toolItems = Array.isArray(toolResp) ? toolResp : [];
      setTools(toolItems.filter((t) => t.isActive).map((t) => ({ id: t.id, name: t.name })));
      setKnowledgeBases(kbResp.items.map((k) => ({ id: k.id, name: k.name })));
      setOrganizations(orgResp.items);
    } catch (error) {
      logger.error('获取资源列表失败', error);
    }
  };

  const handleAdd = () => {
    setEditingRole(null);
    setFormData({
      userName: '',
      phone: '',
      department: '',
      organizationId: '',
      levelType: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      userName: role.userName || '',
      phone: role.phone || '',
      department: role.department || '',
      organizationId: role.organizationId || '',
      levelType: role.levelType || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定要删除该角色吗？')) return;
    try {
      await deleteRole(id);
      await fetchRoles();
    } catch (error) {
      logger.error('删除角色失败', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.userName.trim() || !formData.organizationId || !formData.levelType) return;

    setIsSubmitting(true);
    try {
      // 根据组织和层级自动获取权限
      let permissions: Array<{ permissionType: PermissionType; permissionId: string }> = [];
      if (formData.organizationId) {
        try {
          const orgPerms = await getOrganizationPermissions(formData.organizationId);
          // 筛选匹配的权限（层级匹配或全部层级）
          const filteredPerms = orgPerms.items.filter(
            (p) => p.levelType === formData.levelType || p.levelType === 'all'
          );
          permissions = filteredPerms.map((p) => ({
            permissionType: p.resourceType,
            permissionId: p.resourceId,
          }));
        } catch (e) {
          logger.warn('获取组织权限失败', e);
        }
      }

      // 生成角色名称：用户名称-组织-层级
      const orgName = organizations.find((o) => o.id === formData.organizationId)?.name || '';
      const levelName = formData.levelType === 'management' ? '管理层' : '普通层';
      const roleName = `${formData.userName}-${orgName}-${levelName}`;

      const data: CreateRoleRequest | UpdateRoleRequest = {
        name: roleName,
        userName: formData.userName || undefined,
        phone: formData.phone || undefined,
        department: formData.department || undefined,
        organizationId: formData.organizationId || undefined,
        levelType: formData.levelType || undefined,
        permissions,
      };

      if (editingRole) {
        await updateRole(editingRole.id, data as UpdateRoleRequest);
      } else {
        await createRole(data as CreateRoleRequest);
      }
      setIsDialogOpen(false);
      await fetchRoles();
    } catch (error) {
      logger.error('保存角色失败', error);
    } finally {
      setIsSubmitting(false);
    }
  };



  const getResourceName = (type: PermissionType, id: string) => {
    switch (type) {
      case 'agent':
        return agents.find((a) => a.id === id)?.name || id;
      case 'workflow':
        return workflows.find((w) => w.id === id)?.name || id;
      case 'tool':
        return tools.find((t) => t.id === id)?.name || id;
      case 'knowledge':
        return knowledgeBases.find((k) => k.id === id)?.name || id;
      default:
        return id;
    }
  };

  const getPermissionTypeLabel = (type: PermissionType) => {
    return PERMISSION_TYPES.find((p) => p.value === type)?.label || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">用户管理</h3>
          <p className="text-sm text-muted-foreground">按用户名称、手机号、部门分配角色权限</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          添加用户
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无用户，点击上方按钮添加</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                    {role.description && (
                      <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(role)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(role.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                  {(role.organizationId || role.levelType) && (
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>
                        {role.organizationId && organizations.find(o => o.id === role.organizationId)?.name}
                        {role.organizationId && role.levelType && ' · '}
                        {role.levelType === 'management' ? '管理层' : role.levelType === 'normal' ? '普通层' : ''}
                      </span>
                    </div>
                  )}
                  {role.userName && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>{role.userName}</span>
                    </div>
                  )}
                  {role.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      <span>{role.phone}</span>
                    </div>
                  )}
                  {role.department && (
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      <span>{role.department}</span>
                    </div>
                  )}
                </div>
                {role.permissions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.map((perm) => (
                      <Badge key={`${perm.permissionType}-${perm.permissionId}`} variant="secondary">
                        {getPermissionTypeLabel(perm.permissionType)}: {perm.permissionName || perm.permissionId.slice(0, 8)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DraggableDialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRole ? '编辑用户' : '添加用户'}</DialogTitle>
            <DialogDescription>配置角色信息和权限</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">所属组织 *</label>
                    <Select
                      value={formData.organizationId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, organizationId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择组织..." />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">管理层级 *</label>
                    <Select
                      value={formData.levelType}
                      onValueChange={(value: LevelType) =>
                        setFormData({ ...formData, levelType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择层级..." />
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

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">用户名称 *</label>
                    <Input
                      value={formData.userName}
                      onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                      placeholder="用户名称"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">手机号</label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="手机号"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">部门</label>
                    <Input
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="部门"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  权限将根据所选组织和层级自动分配
                </p>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.userName.trim() || !formData.organizationId || !formData.levelType}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DraggableDialogContent>
      </Dialog>
    </div>
  );
};

export default RoleManageTab;
