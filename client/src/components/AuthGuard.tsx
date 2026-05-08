import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// 检查用户是否已登录
export const isAuthenticated = (): boolean => {
  return localStorage.getItem('isLoggedIn') === 'true';
};

// 获取当前登录用户信息
export const getCurrentUser = (): { username: string; role: string } | null => {
  const userStr = localStorage.getItem('loginUser');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

interface AuthGuardProps {
  children: React.ReactNode;
}

// 登录守卫组件 - 需要登录才能访问
export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const location = useLocation();
  const isLoggedIn = isAuthenticated();

  if (!isLoggedIn) {
    // 未登录，重定向到登录页，并保存原目标地址
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

// 已登录守卫组件 - 已登录用户访问登录页时重定向到首页
export const LoggedInGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const isLoggedIn = isAuthenticated();

  if (isLoggedIn) {
    // 已登录，重定向到首页
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
