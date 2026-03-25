/**
 * Component: components\ProtectedRoute.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowEmployee?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowEmployee = false }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-background/80 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (allowEmployee) {
      const userType = localStorage.getItem('userType');
      const userId = localStorage.getItem('userId');
      if (userType === 'employee' && userId) {
        return <>{children}</>;
      }
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

