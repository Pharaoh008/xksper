import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useMatch, useNavigate, useParams } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList } from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  Database,
  History,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  Wrench,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { useAppInfo } from '@lark-apaas/client-toolkit/hooks/useAppInfo';
import { useCurrentUserProfile } from '@lark-apaas/client-toolkit/hooks/useCurrentUserProfile';
import { getAgent, getWorkflow } from '@/api';
import { UserDisplay } from '@/components/business-ui/user-display';
import { getCurrentUser } from './AuthGuard';

type NavItem = {
  path: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const primaryNavItems: NavItem[] = [
  { path: '/', label: 'LLM 对话', description: '多模型统一入口', icon: MessageSquare },
  { path: '/agent', label: 'Agent', description: '知识库与工具智能体', icon: Bot },
  { path: '/workflow', label: 'Workflow', description: '自动化编排', icon: WorkflowIcon },
  { path: '/history', label: '历史对话', description: '追溯上下文', icon: History },
];

const resourceNavItems: NavItem[] = [
  { path: '/knowledge', label: '知识库', description: '文档与检索上下文', icon: BookOpen },
  { path: '/tools', label: '工具', description: 'MCP / Skill / 插件', icon: Wrench },
  { path: '/data', label: '数据源', description: '业务数据连接', icon: Database },
];

const adminNavItems: NavItem[] = [
  { path: '/config', label: '配置管理', description: '模型与组织权限', icon: Settings, adminOnly: true },
  { path: '/token-monitor', label: 'Token 监控', description: '成本与用量', icon: BarChart3, adminOnly: true },
];

const pageLabels: Record<string, string> = {
  '/': 'LLM 对话',
  '/agent': 'Agent',
  '/workflow': 'Workflow',
  '/knowledge': '知识库',
  '/tools': '工具',
  '/data': '数据源',
  '/config': '配置管理',
  '/token-monitor': 'Token 监控',
  '/history': '历史对话',
};

const isLocalAdmin = () => getCurrentUser()?.role === 'admin';

const isActivePath = (pathname: string, itemPath: string) => {
  if (itemPath === '/') {
    return pathname === '/';
  }
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
};

const LayoutNavLink: React.FC<{ item: NavItem }> = ({ item }) => {
  const location = useLocation();
  const { state } = useSidebar();
  const active = isActivePath(location.pathname, item.path);

  if (item.adminOnly && !isLocalAdmin()) {
    return null;
  }

  return (
    <Link
      to={item.path}
      title={item.label}
      className={[
        'group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      ].join(' ')}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {state !== 'collapsed' && (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.label}</span>
          <span className={['block truncate text-xs', active ? 'text-sidebar-primary-foreground/80' : 'text-muted-foreground'].join(' ')}>
            {item.description}
          </span>
        </span>
      )}
    </Link>
  );
};

const LayoutContent: React.FC = () => {
  const navigate = useNavigate();
  const { appName } = useAppInfo();
  const { state } = useSidebar();
  const profile = useCurrentUserProfile();
  const [resourceCollapsed, setResourceCollapsed] = useState(false);
  const [adminCollapsed, setAdminCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginUser');
    navigate('/login');
  };

  const renderNavSection = (label: string, items: NavItem[], collapsed: boolean, onToggle: () => void) => (
    <div className="border-t border-sidebar-border pt-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-10 w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <span className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          {state !== 'collapsed' && label}
        </span>
        {state !== 'collapsed' && (collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
      </button>
      {!collapsed && (
        <nav className="mt-1 flex flex-col gap-1">
          {items.map((item) => (
            <LayoutNavLink key={item.path} item={item} />
          ))}
        </nav>
      )}
    </div>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-3 rounded-md px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          {state !== 'collapsed' && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-sidebar-foreground">{appName || 'XKS AI Console'}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                企业级多模型网关
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <nav className="flex flex-col gap-1">
          {primaryNavItems.map((item) => (
            <LayoutNavLink key={item.path} item={item} />
          ))}
        </nav>

        {renderNavSection('资源中心', resourceNavItems, resourceCollapsed, () => setResourceCollapsed((value) => !value))}
        {renderNavSection('管理与监控', adminNavItems, adminCollapsed, () => setAdminCollapsed((value) => !value))}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <div className="border-t border-sidebar-border pt-2">
          <div className="flex items-center justify-between rounded-md px-3 py-2">
            {state !== 'collapsed' && <UserDisplay userId={profile.user_id} />}
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
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
  const [agentName, setAgentName] = useState('');
  const [workflowName, setWorkflowName] = useState('');

  useEffect(() => {
    if (agentMatch && agentId) {
      getAgent(agentId)
        .then((agent) => setAgentName(agent?.name || ''))
        .catch(() => setAgentName(''));
    } else {
      setAgentName('');
    }
  }, [agentMatch, agentId]);

  useEffect(() => {
    if (workflowMatch && workflowId && workflowId !== 'new') {
      getWorkflow(workflowId)
        .then((workflow) => setWorkflowName(workflow?.name || ''))
        .catch(() => setWorkflowName(''));
    } else {
      setWorkflowName('');
    }
  }, [workflowMatch, workflowId]);

  const activeTitle = useMemo(() => agentName || workflowName || pageLabels[location.pathname] || 'AI 控制台', [agentName, workflowName, location.pathname]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <LayoutContent />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger />
              <Breadcrumb className="min-w-0 self-center">
                <BreadcrumbList>
                  <BreadcrumbItem className="truncate text-base font-semibold text-foreground">{activeTitle}</BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden gap-1.5 rounded-full border-success/25 bg-success/10 text-success md:flex">
                <Activity className="h-3.5 w-3.5" />
                已连接 Vercel
              </Badge>
            </div>
          </header>
          <div className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
