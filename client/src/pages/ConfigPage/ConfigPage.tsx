import React, { useState } from 'react';
import { Building2, Key, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ApiConfigTab from './ApiConfigTab';
import RoleManageTab from './RoleManageTab';
import OrganizationManageTab from './OrganizationManageTab';

const configTabs = [
  {
    value: 'api',
    label: '模型配置',
    description: 'API Key、模型启用、默认模型',
    icon: Key,
  },
  {
    value: 'organization',
    label: '组织管理',
    description: '企业组织与资源边界',
    icon: Building2,
  },
  {
    value: 'role',
    label: '用户权限',
    description: '角色、可见范围与管理权限',
    icon: Users,
  },
];

const ConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('api');
  const active = configTabs.find((tab) => tab.value === activeTab) || configTabs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">配置管理</h1>
            <Badge variant="outline" className="gap-1.5 rounded-full border-success/25 bg-success/10 text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              管理员
            </Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            统一维护模型供应商、组织边界和用户权限，确保对话、Agent、Workflow 使用同一套可信配置。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {configTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={[
                'rounded-md border px-3 py-2 text-left transition-colors',
                activeTab === tab.value
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground',
              ].join(' ')}
            >
              <tab.icon className="mb-1 h-4 w-4" />
              <span className="block whitespace-nowrap font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 md:grid-cols-3">
          {configTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-auto justify-start gap-3 rounded-md border border-border bg-card px-4 py-3 text-left data-[state=active]:border-primary data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              <tab.icon className="h-5 w-5 shrink-0" />
              <span className="min-w-0">
                <span className="block font-semibold">{tab.label}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">{tab.description}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-5 border-b border-border pb-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <active.icon className="h-5 w-5 text-primary" />
              {active.label}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{active.description}</p>
          </div>

          <TabsContent value="api" className="m-0">
            <ApiConfigTab />
          </TabsContent>

          <TabsContent value="organization" className="m-0">
            <OrganizationManageTab />
          </TabsContent>

          <TabsContent value="role" className="m-0">
            <RoleManageTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ConfigPage;
