type FetchInput = RequestInit | undefined;

const normalizeApiBaseUrl = (rawValue: string | undefined): string => {
  const value = (rawValue || '').trim();
  if (!value) {
    return '/api';
  }

  if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
    return value.replace(/\/+$/, '');
  }

  if (value.startsWith(':')) {
    return `http://localhost${value}`.replace(/\/+$/, '');
  }

  if (value.startsWith('//')) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    return `${protocol}${value}`.replace(/\/+$/, '');
  }

  if (/^[a-z0-9.-]+:\d+/i.test(value)) {
    return `http://${value}`.replace(/\/+$/, '');
  }

  return `/${value.replace(/^\/+/, '').replace(/\/+$/, '')}`;
};

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

const resolveApiPath = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseEndsWithApi = API_BASE_URL.endsWith('/api');
  const pathStartsWithApi = normalizedPath === '/api' || normalizedPath.startsWith('/api/');
  const pathSuffix = baseEndsWithApi && pathStartsWithApi
    ? normalizedPath.slice(4) || '/'
    : normalizedPath;

  return `${API_BASE_URL}${pathSuffix}`;
};

const withDefaults = (init?: FetchInput): RequestInit => ({
  credentials: 'include',
  ...init,
});

const buildCandidates = (primaryPath: string, fallbackPaths: string[] = []): string[] => {
  const candidates = [primaryPath, ...fallbackPaths];
  return candidates.filter((path) => Boolean(path));
};

const shouldFallback = (response: Response): boolean =>
  response.status === 404 || response.status === 405;

async function fetchWithFallback(
  primaryPath: string,
  fallbackPaths: string[] = [],
  init?: FetchInput
): Promise<Response> {
  const candidates = buildCandidates(primaryPath, fallbackPaths);
  const requestInit = withDefaults(init);

  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const path = candidates[i];
    const isLast = i === candidates.length - 1;

    try {
      const response = await fetch(resolveApiPath(path), requestInit);
      lastResponse = response;

      if (isLast || !shouldFallback(response)) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (isLast) {
        throw error;
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error('HRMS API request failed');
}

const makeQueryPath = (basePath: string, params?: URLSearchParams): string => {
  if (!params || !params.toString()) {
    return basePath;
  }
  return `${basePath}?${params.toString()}`;
};

export const hrmsApi = {
  getLeaveRequests: () =>
    fetchWithFallback('/api/hrms/leaves/', ['/api/auth/leave/my-requests/']),

  getLeaveTypes: () =>
    fetchWithFallback('/api/hrms/leaves/types/', ['/api/auth/leave/types/']),

  applyLeave: (payload: FormData) =>
    fetchWithFallback('/api/hrms/leaves/apply/', ['/api/auth/leave/apply/'], {
      method: 'POST',
      body: payload,
    }),

  getPendingLeaves: () =>
    fetchWithFallback('/api/hrms/leaves/pending/', ['/api/auth/admin/leave/pending/']),

  approveLeave: (leaveRequestId: number) => {
    const payload = new FormData();
    payload.append('leave_request_id', String(leaveRequestId));

    return fetchWithFallback('/api/hrms/leaves/approve/', ['/api/auth/admin/leave/approve/'], {
      method: 'POST',
      body: payload,
    });
  },

  rejectLeave: (leaveRequestId: number, rejectionReason: string) => {
    const payload = new FormData();
    payload.append('leave_request_id', String(leaveRequestId));
    payload.append('rejection_reason', rejectionReason);
    payload.append('status', 'REJECTED');

    return fetchWithFallback(
      '/api/hrms/leaves/approve/',
      ['/api/hrms/leaves/reject/', '/api/auth/admin/leave/reject/'],
      {
        method: 'POST',
        body: payload,
      }
    );
  },

  getDocuments: () =>
    fetchWithFallback('/api/hrms/documents/', ['/api/auth/documents/my-documents/']),

  uploadDocument: (payload: FormData) =>
    fetchWithFallback('/api/hrms/documents/upload/', ['/api/auth/documents/upload/'], {
      method: 'POST',
      body: payload,
    }),

  deleteDocument: (documentId: number) =>
    fetchWithFallback(`/api/hrms/documents/${documentId}/`, [`/api/auth/documents/${documentId}/delete/`], {
      method: 'DELETE',
    }),

  downloadDocument: (documentId: number) =>
    fetchWithFallback(
      `/api/hrms/documents/${documentId}/download/`,
      [`/api/auth/documents/${documentId}/download/`]
    ),

  getNotifications: () =>
    fetchWithFallback('/api/hrms/notifications/', ['/api/auth/notifications/']),

  markNotificationAsRead: (notificationId?: number) => {
    if (notificationId) {
      const payload = new FormData();
      payload.append('notification_id', String(notificationId));

      return fetchWithFallback('/api/hrms/notifications/read/', [`/api/auth/notifications/${notificationId}/read/`], {
        method: 'POST',
        body: payload,
      });
    }

    const payload = new FormData();
    payload.append('mark_all', 'true');

    return fetchWithFallback('/api/hrms/notifications/read/', ['/api/auth/notifications/read-all/'], {
      method: 'POST',
      body: payload,
    });
  },

  getDirectoryEmployees: (params?: URLSearchParams) =>
    fetchWithFallback(
      makeQueryPath('/api/hrms/employees/', params),
      [makeQueryPath('/api/auth/directory/', params)]
    ),

  getAnalyticsOverview: () =>
    fetchWithFallback('/api/auth/admin/dashboard/stats/', ['/api/hrms/analytics/overview/']),

  getAnalyticsPayroll: () =>
    fetchWithFallback('/api/auth/admin/dashboard/payroll-distribution/', ['/api/hrms/analytics/payroll/']),

  getAnalyticsAttendance: () =>
    fetchWithFallback('/api/auth/admin/dashboard/attendance-graph/', ['/api/hrms/analytics/attendance/']),

  getAnalyticsLeave: () =>
    fetchWithFallback('/api/auth/admin/dashboard/leave-stats/', ['/api/hrms/analytics/leaves/']),
};

export async function getJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
