/**
 * Component: components\UnifiedLogin.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '@/services/api';
import BrandMark from './BrandMark';

interface LoginApiUser {
  id?: number | string;
  name?: string;
  full_name?: string;
  username?: string;
  email?: string;
  role?: string;
  user_role?: string;
  user_type?: string;
}

interface LoginApiResponse {
  success?: boolean;
  message?: string;
  token?: string;
  access?: string;
  auth_token?: string;
  role?: string;
  user?: LoginApiUser;
}

const adminRoles = new Set(['admin', 'hr', 'ceo']);

const toLower = (value: unknown): string => String(value || '').trim().toLowerCase();

const UnifiedLogin: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    usernameOrEmail: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!formData.usernameOrEmail || !formData.password) {
      setError('Please enter both username/email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.login({
        username: formData.usernameOrEmail,
        password: formData.password,
      });

      const data = response.data as LoginApiResponse;
      const loginSucceeded = data.success !== false && Boolean(data.user);

      if (!loginSucceeded) {
        setError(data.message || 'Login failed. Please try again.');
        return;
      }

      const user = data.user as LoginApiUser;
      const responseRole = toLower(
        user.role || user.user_role || user.user_type || data.role
      );
      const hasAdminShape = Boolean(user?.username || user?.full_name);
      const normalizedRole = responseRole || (hasAdminShape ? 'admin' : 'employee');
      const userType = adminRoles.has(normalizedRole) ? 'admin' : 'employee';
      const token = data.token || data.access || data.auth_token || '';

      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userType', userType);
      localStorage.setItem('userRole', normalizedRole);
      localStorage.setItem('userId', String(user.id || ''));
      if (token) {
        localStorage.setItem('authToken', token);
      } else {
        localStorage.removeItem('authToken');
      }

      if (userType === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/employee/dashboard', { replace: true });
      }
    } catch (loginError: any) {
      const errorPayload = loginError?.response?.data;
      if (errorPayload?.requires_onboarding) {
        localStorage.setItem('userType', 'employee');
        localStorage.setItem('userRole', 'employee');
        if (errorPayload.employee_id) {
          localStorage.setItem('userId', String(errorPayload.employee_id));
        }
        navigate('/onboarding', { replace: true });
        return;
      }
      setError(
        errorPayload?.message ||
          'Invalid credentials. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-emerald-50 to-white flex items-center justify-center p-4 md:p-6">
      <div className="relative w-[92vw] max-w-[560px] aspect-square flex items-center justify-center">
        <div className="absolute inset-0 animate-rotate">
          <span className="circle pulse-1 border-pink-500/70" />
          <span className="circle pulse-2 border-amber-400/70" />
          <span className="circle pulse-3 border-cyan-500/70" />
          <span className="circle pulse-4 border-emerald-500/70" />
        </div>

        <div className="relative z-10 w-full max-w-[420px] p-6 md:p-8">
          <div className="flex flex-col items-center gap-2 mb-6">
           <div className="flex items-center justify-center mb-3">
              <BrandMark />
            </div>
            <p className="text-sm font-medium text-slate-500">Payroll & Employee Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="usernameOrEmail" className="text-sm font-medium text-slate-700">
                Username or Email
              </label>
              <input
                id="usernameOrEmail"
                type="text"
                value={formData.usernameOrEmail}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    usernameOrEmail: event.target.value,
                  }))
                }
                placeholder="Enter your username or email"
                disabled={isLoading}
                className="block w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Enter your password"
                  disabled={isLoading}
                  className="block w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 pr-11 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-gradient-to-r from-[#8b1538] to-[#00bcd4] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UnifiedLogin;

