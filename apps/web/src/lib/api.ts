import type { HealthResponse, MeResponse, ApiError } from '@infohq/shared';

const API_BASE = import.meta.env.VITE_API_URL || '';

export class ApiRequestError extends Error {
  status: number;
  data: ApiError;

  constructor(status: number, data: ApiError) {
    super(data.message || `API Request failed with status ${status}`);
    this.name = 'ApiRequestError';
    this.status = status;
    this.data = data;
  }
}

export async function fetchWithAuth<T>(
  endpoint: string,
  getToken: () => Promise<string | null>,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: ApiError;
    try {
      errorData = (await response.json()) as ApiError;
    } catch {
      errorData = {
        error: 'unknown_error',
        message: response.statusText || 'An error occurred during API request',
      };
    }
    throw new ApiRequestError(response.status, errorData);
  }

  return response.json() as Promise<T>;
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return response.json() as Promise<HealthResponse>;
}

export async function fetchMe(getToken: () => Promise<string | null>): Promise<MeResponse> {
  return fetchWithAuth<MeResponse>('/api/me', getToken);
}
