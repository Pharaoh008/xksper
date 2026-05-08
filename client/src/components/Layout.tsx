import React, { useState } from 'react';
import { Link, useLocation, Outlet, useParams, useMatch, useNavigate } from 'react-router-dom';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem } from '@/components/ui/breadcrumb';
import { MessageSquare, Settings, BarChart3, History, Bot, Workflow as WorkflowIcon, BookOpen, User, ChevronDown, ChevronRight, Wrench, Database, LogOut } from 'lucide-react';
import { useAppInfo } from '@lark-apaas/client-toolkit/hooks/useAppInfo';
import { useEffect } from 'react';
import { getAgent, getWorkflow } from '@/api';
import { useCurrentUserProfile } from '@lark-apaas/client-toolkit/hooks/useCurrentUserProfile';
import { UserDisplay } from '@/components/business-ui/user-display';
import { getCurrentUser } from './AuthGuard';

type NavItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { path: '/', label: 'LLM', icon: MessageSquare },
  { path: '/agent', label: 'Agent', icon: Bot },
  { path: '/workflow', label: 'Workflow', icon: WorkflowIcon },
  { path: '/history', label: '历史对话', icon: History },
];

const settingsItems: NavItem[] = [
  { path: '/knowledge', label: '知识库', icon: BookOpen },
  { path: '/tools', label: '工具', icon: Wrench },
  { path: '/data', label: '数据源', icon: Database },
  { path: '/config', label: '配置管理', icon: Settings, adminOnly: true },
  { path: '/token-monitor', label: 'Token监控', icon: BarChart3, adminOnly: true },
];

const menuLabels: Record<string, string> = {
  '/': 'LLM',
  '/agent': 'Agent',
  '/workflow': 'Workflow',
  '/knowledge': '知识库',
  '/tools': '工具',
  '/data': '数据源',
  '/config': '配置管理',
  '/token-monitor': 'Token监控',
  '/history': '历史对话',
};

const isLocalAdmin = () => getCurrentUser()?.role === 'admin';

const LayoutContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { appName } = useAppInfo();
  const [settingsCollapsed, setSettingsCollapsed] = useState(true);
  const { state } = useSidebar();

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginUser');
    navigate('/login');
  };

  const renderNavItem = (item: NavItem) => {
    if (item.adminOnly) {
      if (!isLocalAdmin()) {
        return null;
      }

      return (
        <Link
          key={item.path}
          to={item.path}
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            location.pathname === item.path
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          }`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          location.pathname === item.path
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        }`}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const renderSettingsItem = (item: NavItem) => {
    if (item.adminOnly) {
      if (!isLocalAdmin()) {
        return null;
      }

      return (
        <Link
          key={item.path}
          to={item.path}
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            location.pathname === item.path
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          location.pathname === item.path
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sidebar-foreground truncate">
            {appName || 'AI助手'}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map((item) => renderNavItem(item))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="p-2">
        {/* 可折叠的设置区域 */}
        <div className="border-t border-border pt-2 mt-2">
          <button
            onClick={() => setSettingsCollapsed(!settingsCollapsed)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {state !== 'collapsed' && '设置'}
            </span>
            {state !== 'collapsed' && (
              settingsCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )
            )}
          </button>
          {!settingsCollapsed && (
            <nav className="flex flex-col gap-1 mt-1">
              {settingsItems.map((item) => renderSettingsItem(item))}
            </nav>
          )}
        </div>
        <div className="flex items-center justify-between px-3 py-2 mt-2 border-t border-border pt-2">
          <UserDisplay userId={useCurrentUserProfile().user_id} />
          <button
            onClick={handleLogout}
            className="p-2 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

const Layout: React.FC = () => {
  const location = useLocation();
  const agentMatch = useMatch('/agent/:agentId');
  const workflowMatch = useMatch('/workflow/:workflowId');
  const { agentId } = useParams<{ agentId: string }>();
  const { workflowId } = useParams<{ workflowId: string }>();
  const [agentName, setAgentName] = useState<string>('');
  const [workflowName, setWorkflowName] = useState<string>('');

  useEffect(() => {
    if (agentMatch && agentId) {
      getAgent(agentId).then((agent) => {
        if (agent) {
          setAgentName(agent.name);
        }
      }).catch(() => {
        setAgentName('');
      });
    } else {
      setAgentName('');
    }
  }, [agentMatch, agentId]);

  useEffect(() => {
    if (workflowMatch && workflowId && workflowId !== 'new') {
      getWorkflow(workflowId).then((workflow) => {
        if (workflow) {
          setWorkflowName(workflow.name);
        }
      }).catch(() => {
        setWorkflowName('');
      });
    } else {
      setWorkflowName('');
    }
  }, [workflowMatch, workflowId]);

  const activeTitle = agentName || workflowName || menuLabels[location.pathname] || 'AI助手';

  return (
    <SidebarProvider>
      <LayoutContent />
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="flex items-center gap-2 px-6 py-4 border-b border-border">
          <SidebarTrigger />
          <Breadcrumb className="self-center">
            <BreadcrumbList>
              <BreadcrumbItem className="text-foreground font-semibold">
                {activeTitle}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex-1 overflow-auto">
          <div className="max-w-[1600px] mx-auto p-6">
            <Outlet />
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default Layout;
