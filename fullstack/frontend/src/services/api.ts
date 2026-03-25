import axios, { AxiosHeaders } from 'axios';

const normalizeApiBaseUrl = (rawValue: string | undefined): string => {
  const value = (rawValue || '').trim();
  if (!value) {
    return '/api';
  }

  if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
    return value;
  }

  if (value.startsWith(':')) {
    return `http://localhost${value}`;
  }

  if (value.startsWith('//')) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    return `${protocol}${value}`;
  }

  if (/^[a-z0-9.-]+:\d+/i.test(value)) {
    return `http://${value}`;
  }

  return `/${value.replace(/^\/+/, '')}`;
};

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const cookieMatch = document.cookie.match(new RegExp(`(^|;\s*)${name}=([^;]*)`));
  return cookieMatch ? decodeURIComponent(cookieMatch[2]) : null;
};

// Request interceptor to add auth token and CSRF token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      const scheme = token.includes('.') ? 'Bearer' : 'Token';
      const headers = AxiosHeaders.from(config.headers);
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `${scheme} ${token}`);
      }
      config.headers = headers;
    }

    const csrfToken = getCookie('csrftoken');
    if (csrfToken && ['post', 'put', 'patch', 'delete'].includes((config.method || '').toLowerCase())) {
      const headers = AxiosHeaders.from(config.headers);
      if (!headers.has('X-CSRFToken') && !headers.has('X-CSRF-Token')) {
        headers.set('X-CSRFToken', csrfToken);
      }
      config.headers = headers;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    const csrfTokenFromHeader = response.headers['x-csrftoken'] || response.headers['x-csrf-token'];
    if (csrfTokenFromHeader) {
      if (typeof document !== 'undefined') {
        document.cookie = `csrftoken=${encodeURIComponent(csrfTokenFromHeader)}; path=/`;
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && !currentPath.startsWith('/activate/')) {
        window.location.href = '/login';
      }
    }

    const requestUrl = String(error.config?.url || '');
    const isProfileProbe =
      requestUrl.includes('/auth/profile/') &&
      (error.response?.status === 401 || error.response?.status === 403);
    
    if (!isProfileProbe) {
      // Enhanced error logging
      console.error('API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data
        }
      });
    }
    
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    api.post('/auth/login/', credentials),
  logout: () => api.post('/auth/logout/'),
  getProfile: () => api.get('/auth/profile/'),
};

// Employee API
export const employeeAPI = {
  getAll: () => api.get('/employees/'),
  getById: (id: string) => api.get(`/employees/${id}/`),
  getOverview: (id: string) => api.get(`/employees/${id}/overview/`),
  create: (data: any) => api.post('/employees/', data),
  update: (id: string, data: any) => api.put(`/employees/${id}/`, data),
  delete: (id: string) => api.delete(`/employees/${id}/`),
  importExcel: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/employees/import/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getByDepartment: (departmentId: string) => 
    api.get(`/employees/?department=${departmentId}`),
  sendWelcomeEmail: (employeeId: string) => 
    api.post(`/employees/${employeeId}/send-welcome-email/`),
  sendBulkWelcomeEmails: (employeeIds: string[]) => 
    api.post('/employees/send-bulk-welcome-emails/', { employee_ids: employeeIds }),
  sendWelcomeEmailWithCredentials: (employeeId: string, credentials: { personal_email?: string; password?: string }) => 
    api.post(`/employees/${employeeId}/send-welcome-email-with-credentials/`, credentials),
  regeneratePassword: (employeeId: string, mode: 'view' | 'mail') =>
    api.post(`/employees/${employeeId}/regenerate-password/`, { mode }),
  getEmployeesForWelcomeEmail: () => 
    api.get('/employees/welcome-email-employees/'),
  getEmailLogs: (params?: { email_type?: string; status?: string; employee_id?: string; limit?: number }) => 
    api.get('/employees/email-logs/', { params }),
  processWelcomeEmailExcel: (file: File | null, manualData?: any) => {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    } else if (manualData) {
      for (const key in manualData) {
        formData.append(key, manualData[key]);
      }
    }
    return api.post('/employees/process-welcome-email-excel/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export const monthlySalaryAPI = {
  getAll: () => api.get('/employees/monthly-salaries/'),
  getById: (id: string | number) => api.get(`/employees/monthly-salaries/${id}/`),
  create: (data: any) => api.post('/employees/monthly-salaries/', data),
  update: (id: string | number, data: any) => api.put(`/employees/monthly-salaries/${id}/`, data),
  delete: (id: string | number) => api.delete(`/employees/monthly-salaries/${id}/`),
  getByMonthYear: (month: string, year: number) => 
    api.get(`/employees/monthly-salaries/${month}/${year}/`),
  uploadExcel: (file: File, month: string, year: number | string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('month', month);
    formData.append('year', String(year));
    return api.post('/employees/monthly-salaries/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getStats: () => api.get('/employees/monthly-salaries/stats/'),
};

// Salary Calculation Preview API
export const salaryPreviewAPI = {
  getPreview: (employeeIds: Array<number | string>, month: string, year: number) => {
    const params = new URLSearchParams();
    employeeIds.forEach(id => params.append('employee_ids', String(id)));
    params.append('month', month);
    params.append('year', year.toString());
    return api.get(`/employees/salary-preview/?${params.toString()}`);
  },
};

// Actual Salary Credited API
export const actualSalaryAPI = {
  upload: (employeeSalaries: Array<{employee_id: number | string, actual_salary_credited: number}>, month: string, year: number) => 
    api.post('/employees/actual-salary/upload/', {
      employee_salaries: employeeSalaries,
      month,
      year
    }),
  getByMonthYear: (month: string, year: number) => 
    api.get(`/employees/actual-salary/?month=${month}&year=${year}`),
  getAll: () => api.get('/employees/actual-salary/'),
};

// Department API
export const departmentAPI = {
  getAll: () => api.get('/departments/'),
  getById: (id: string) => api.get(`/departments/${id}/`),
  create: (data: any) => api.post('/departments/', data),
  update: (id: string, data: any) => api.put(`/departments/${id}/`, data),
  delete: (id: string) => api.delete(`/departments/${id}/`),
};

// Payslip API
export const payslipAPI = {
  generateSingle: (data: any) => api.post('/payslips/generate/', data),
  bulkGenerate: (data: any) => api.post('/payslips/generate/', data),
  getGenerationStatus: (taskId: string) => 
    api.get(`/payslips/task/${taskId}/`),
  downloadPayslip: (payslipId: string) => 
    api.get(`/payslips/${payslipId}/download/`, { responseType: 'blob' }),
  downloadMonthlyPayslips: (year: string, month: string) =>
    api.get(`/payslips/download-monthly/${year}/${month}/`, { responseType: 'blob' }),
  getPayslipFiles: (year: string, month: string) =>
    api.get(`/payslips/files/${year}/${month}/`),
  sendSelected: (payslipIds: number[], overrideEmails?: Record<string, string>) =>
    api.post('/payslips/send-selected/', {
      payslip_ids: payslipIds,
      override_emails: overrideEmails || {},
    }),
  getAll: () => api.get('/payslips/'),
  getStats: () => api.get('/payslips/stats/'),
};

// Dashboard API - Real data endpoints
export const dashboardAPI = {
  // Employee endpoints
  getEmployeeCount: () => api.get('/employees/count/'),
  getEmployeeSummary: () => api.get('/employees/summary/'),
  
  // Payroll endpoints
  getPayrollMonthSummary: () => api.get('/payroll/month-summary/'),
  
  // Leave endpoints
  getLeavePendingCount: () => api.get('/leaves/pending-count/'),
  getLeaveOverview: () => api.get('/leaves/overview/'),
  
  // Attendance endpoints
  getAttendanceTodaySummary: () => api.get('/attendance/today-summary/'),
  
  // Activity endpoints
  getDashboardActivity: () => api.get('/dashboard/activity/'),
  
  // All-in-one dashboard data
  getDashboardData: () => api.get('/dashboard/'),
};

// Attendance Management API
export const attendanceAPI = {
  getDashboard: (params?: { date?: string; department?: string | number; location?: string; shift?: string | number }) =>
    api.get('/attendance/dashboard', { params }),
  getEmployeeDashboard: (employeeId?: string | number) =>
    api.get('/auth/employee/dashboard/', { params: employeeId ? { employee_id: employeeId } : {} }),
  punchIn: (payload: { employee_id?: string | number; latitude?: number | string; longitude?: number | string; notes?: string; workType?: 'WFO' | 'WFH' | 'ON_SITE' }) =>
    api.post('/attendance/punch-in', payload),
  punchOut: (payload: { employee_id?: string | number; latitude?: number | string; longitude?: number | string; notes?: string }) =>
    api.post('/attendance/punch-out', payload),
  getToday: (employeeId?: string | number) =>
    api.get('/attendance/today', { params: employeeId ? { employee_id: employeeId } : {} }),
  getMonthly: (params: { month: number; year: number; employee_id?: string | number }) =>
    api.get('/attendance/monthly', { params }),
  getReport: (params?: {
    employee_id?: string | number;
    start_date?: string;
    end_date?: string;
    department?: string | number;
    location?: string;
    shift?: string | number;
  }) => api.get('/attendance/report', { params }),
  getDashboardData: (params?: { date?: string; department?: string | number; location?: string; shift?: string | number }) =>
    api.get('/attendance/dashboard', { params }),

  getPayrollData: (params: { month: number; year: number; employee_id?: string | number }) =>
    api.get('/attendance/payroll-data', { params }),
  runAbsentAutomation: (date?: string) =>
    api.post('/attendance/automation/mark-absent', date ? { date } : {}),

  // Shift management
  getShifts: () => api.get('/shifts'),
  createShift: (payload: {
    name: string;
    start_time: string;
    end_time: string;
    late_after: string;
    half_day_after: string;
    overtime_allowed: boolean;
    is_active?: boolean;
  }) => api.post('/shifts', payload),
  updateShift: (id: number, payload: Partial<{
    name: string;
    start_time: string;
    end_time: string;
    late_after: string;
    half_day_after: string;
    overtime_allowed: boolean;
    is_active: boolean;
  }>) => api.put(`/shifts/${id}`, payload),
  assignShift: (payload: {
    employee_id: string | number;
    shift_id: string | number;
    office_location_id?: string | number;
    policy_id?: string | number;
    effective_from?: string;
    effective_to?: string;
  }) => api.post('/shifts/assign', payload),
  getShiftAssignments: (employeeId?: string | number) =>
    api.get('/shifts/assignments', {
      params: employeeId ? { employee_id: employeeId } : {},
    }),

  // Office location management
  getOfficeLocations: () => api.get('/office-location'),
  createOfficeLocation: (payload: {
    name: string;
    latitude: number | string;
    longitude: number | string;
    allowed_radius_meters: number;
    is_default?: boolean;
    is_active?: boolean;
  }) => api.post('/office-location', payload),
  updateOfficeLocation: (id: number, payload: Partial<{
    name: string;
    latitude: number | string;
    longitude: number | string;
    allowed_radius_meters: number;
    is_default: boolean;
    is_active: boolean;
  }>) => api.put(`/office-location/${id}`, payload),

  // Policy management
  getPolicies: () => api.get('/attendance/policies'),
  createPolicy: (payload: {
    name: string;
    default_shift?: number | string;
    default_office_location?: number | string;
    enforce_gps: boolean;
    allow_remote_punch: boolean;
    auto_mark_absent: boolean;
    min_half_day_hours: number | string;
    full_day_hours: number | string;
    week_off_days: number[];
    is_active?: boolean;
  }) => api.post('/attendance/policies', payload),
  updatePolicy: (id: number, payload: Partial<{
    name: string;
    default_shift: number | string;
    default_office_location: number | string;
    enforce_gps: boolean;
    allow_remote_punch: boolean;
    auto_mark_absent: boolean;
    min_half_day_hours: number | string;
    full_day_hours: number | string;
    week_off_days: number[];
    is_active: boolean;
  }>) => api.put(`/attendance/policies/${id}`, payload),

  // Holiday management
  getHolidays: () => api.get('/attendance/holidays'),
  createHoliday: (payload: {
    name: string;
    holiday_date: string;
    is_optional?: boolean;
    location?: number | string | null;
  }) => api.post('/attendance/holidays', payload),
  updateHoliday: (id: number, payload: Partial<{
    name: string;
    holiday_date: string;
    is_optional: boolean;
    location: number | string | null;
  }>) => api.put(`/attendance/holidays/${id}`, payload),

  // Configuration status
  getConfigStatus: () => api.get('/attendance/config-status'),
};

// Employee Activation & Onboarding API
export const employeeActivationAPI = {
  activate: (data: { token: string; password: string; confirm_password: string }) =>
    api.post('/auth/employee/activate/', data),
  sendInvitation: (employeeId: number | string) =>
    api.post('/auth/employee/send-invitation/', { employee_id: employeeId }),
  onboard: (data: FormData) =>
    api.post('/auth/employee/onboarding/', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
};

// Employee Dashboard API
export const employeeDashboardAPI = {
  getProfile: (employeeId: number | string) =>
    api.get(`/authentication/employee/profile/`, { params: { employee_id: employeeId } }),
  getPayslips: (employeeId: number | string) =>
    api.get(`/authentication/employee/payslips/`, { params: { employee_id: employeeId } }),
  getAttendanceHistory: (employeeId: number | string) =>
    api.get(`/authentication/employee/attendance_history/`, { params: { employee_id: employeeId } }),
  signIn: (employeeId: number | string) =>
    api.post('/auth/employee/sign-in/', { employee_id: employeeId }),
  signOut: (employeeId: number | string) =>
    api.post('/auth/employee/sign-out/', { employee_id: employeeId }),
};

// Employee Management Admin API
export const employeeAdminAPI = {
  bulkReleasePayslips: (data: { month: string; year: number; selected_employees?: number[] }) =>
    api.post('/auth/employee/bulk-release-payslips/', data),
  sendRelievingLetter: (data: FormData) =>
    api.post('/employees/send-relieving-letter/', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
};

export default api;
