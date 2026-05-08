import React, { useState } from 'react';
import { Key, Users, Building2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ApiConfigTab from './ApiConfigTab';
import RoleManageTab from './RoleManageTab';
import OrganizationManageTab from './OrganizationManageTab';

const ConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('api');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">配置管理</h2>
        <p className="text-muted-foreground">管理 API 配置和用户权限</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            模型管理
          </TabsTrigger>
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            组织管理
          </TabsTrigger>
          <TabsTrigger value="role" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            用户管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization">
          <OrganizationManageTab />
        </TabsContent>

        <TabsContent value="api">
          <ApiConfigTab />
        </TabsContent>

        <TabsContent value="role">
          <RoleManageTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfigPage;
