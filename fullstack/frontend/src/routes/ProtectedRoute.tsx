/**
 * Component: routes\ProtectedRoute.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type RoleMode = 'admin' | 'employee' | 'either';

interface ProtectedRouteProps {
  role: RoleMode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ role }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const userType = localStorage.getItem('userType');
  const userRole = (localStorage.getItem('userRole') || '').toLowerCase();
  const token = localStorage.getItem('authToken');
  const storedUser = localStorage.getItem('user');
  const hasAdminRole = userRole === 'admin' || userRole === 'hr' || userRole === 'ceo';
  const hasEmployeeRole = userRole === 'employee';
  const hasSession = Boolean(isAuthenticated || token || storedUser);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  const isAdmin = hasSession && (userType === 'admin' || hasAdminRole);
  const isEmployee = hasSession && (userType === 'employee' || hasEmployeeRole);

  if (role === 'admin' && !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'employee' && !isEmployee) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'either' && !isAdmin && !isEmployee) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;

