import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/api';

interface AdminUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

interface AuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    if ((import.meta as any).env.MODE !== 'production') {
      console.warn('useAuth called outside AuthProvider. Falling back to safe defaults.');
    }
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: async () => false,
      logout: async () => {},
    };
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const currentPath = window.location.pathname;
    const isPublicRoute = currentPath === '/login' || currentPath.startsWith('/activate/');
    const userType = localStorage.getItem('userType');
    const storedUser = localStorage.getItem('user');

    // For employee routes, restore user from localStorage — no JWT profile call needed
    if (userType === 'employee' && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
      setIsLoading(false);
      return;
    }

    const hasStoredSession =
      Boolean(localStorage.getItem('authToken')) ||
      Boolean(storedUser) ||
      Boolean(userType);

    if (!hasStoredSession && isPublicRoute) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    // Skip profile check for employee routes
    const isEmployeeRoute = currentPath.startsWith('/employee/');
    if (isEmployeeRoute) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await authAPI.getProfile();
      if (response.data) {
        setUser(response.data);
      }
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status !== 401 && status !== 403) {
        console.error('Failed to check auth status:', error);
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await authAPI.login({ username, password });
      
      if (response.data.success) {
        setUser(response.data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
