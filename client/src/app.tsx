import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import ChatPage from './pages/ChatPage/ChatPage';
import ConfigPage from './pages/ConfigPage/ConfigPage';
import TokenMonitorPage from './pages/TokenMonitorPage/TokenMonitorPage';
import HistoryPage from './pages/HistoryPage/HistoryPage';
import AgentListPage from './pages/AgentPage/AgentPage';
import AgentChatPage from './pages/AgentChatPage/AgentChatPage';
import AgentEditPage from './pages/AgentEditPage/AgentEditPage';
import WorkflowListPage from './pages/WorkflowPage/WorkflowPage';
import WorkflowEditorPage from './pages/WorkflowEditorPage/WorkflowEditorPage';
import KnowledgePage from './pages/KnowledgePage/KnowledgePage';
import KnowledgeDetailPage from './pages/KnowledgeDetailPage/KnowledgeDetailPage';
import ToolPage from './pages/ToolPage/ToolPage';
import DataPage from './pages/DataPage/DataPage';
import LoginPage from './pages/LoginPage/LoginPage';
import N8nConfigPage from './pages/N8nConfigPage/N8nConfigPage';
import { AuthGuard, LoggedInGuard, getCurrentUser } from './components/AuthGuard';

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return getCurrentUser()?.role === 'admin' ? <>{children}</> : <Navigate to="/" replace />;
};

// 需要登录才能访问的 Layout 包装器
const ProtectedLayout: React.FC = () => {
  return (
    <AuthGuard>
      <Layout />
    </AuthGuard>
  );
};

const RoutesComponent: React.FC = () => {
  return (
    <Routes>
      {/* 登录页面 - 已登录用户自动跳转到首页 */}
      <Route
        path="/login"
        element={
          <LoggedInGuard>
            <LoginPage />
          </LoggedInGuard>
        }
      />

      {/* 需要登录才能访问的页面 */}
      <Route element={<ProtectedLayout />}>
        <Route index element={<ChatPage />} />
        <Route path="/agent" element={<AgentListPage />} />
        <Route path="/agent/:agentId" element={<AgentChatPage />} />
        <Route path="/agent/:agentId/edit" element={<AgentEditPage />} />
        <Route path="/workflow" element={<WorkflowListPage />} />
        <Route path="/workflow/:workflowId" element={<WorkflowEditorPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/knowledge/:id" element={<KnowledgeDetailPage />} />
        <Route path="/tools" element={<ToolPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/n8n-config" element={<N8nConfigPage />} />
        <Route
          path="/config"
          element={
            <AdminRoute>
              <ConfigPage />
            </AdminRoute>
          }
        />
        <Route
          path="/token-monitor"
          element={
            <AdminRoute>
              <TokenMonitorPage />
            </AdminRoute>
          }
        />
      </Route>

      {/* 404页面 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
