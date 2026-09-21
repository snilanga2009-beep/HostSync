const API_BASE = (import.meta.env.VITE_API_BASE as string || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('resortcare_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is FormData, delete Content-Type to let browser set boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    let errorData = null;
    try {
      errorData = await response.json();
      if (errorData?.error) {
        errorMsg = errorData.error;
      }
    } catch (e) {
      // Body not JSON
    }
    throw new ApiError(errorMsg, response.status, errorData);
  }

  // If response is CSV or blob
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return (await response.text()) as any;
  }

  return await response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, data?: any) => request<T>(endpoint, {
    method: 'POST',
    body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined)
  }),
  put: <T>(endpoint: string, data?: any) => request<T>(endpoint, {
    method: 'PUT',
    body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined)
  }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),

  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return await request<{ success: boolean; url: string; filename: string }>('/uploads', {
      method: 'POST',
      body: formData
    });
  }
};
