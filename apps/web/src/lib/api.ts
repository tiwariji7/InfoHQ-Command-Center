import type {
  HealthResponse,
  MeResponse,
  ApiError,
  Lead,
  LeadNote,
  LeadDetailResponse,
  CreateLeadInput,
  UpdateLeadStageInput,
  LeadListQuery,
  PaginatedResponse,
  DuplicateCheckResult,
} from '@infohq/shared';

function buildUrl(endpoint: string): string {
  const base = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!base) return endpoint;
  if (base.endsWith('/api') && endpoint.startsWith('/api')) {
    return `${base}${endpoint.slice(4)}`;
  }
  return `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}

export class ApiRequestError extends Error {
  status: number;
  data: ApiError & { matches?: DuplicateCheckResult['matches'] };

  constructor(status: number, data: ApiError & { matches?: DuplicateCheckResult['matches'] }) {
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

  const url = buildUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: ApiError & { matches?: DuplicateCheckResult['matches'] };
    try {
      errorData = (await response.json()) as ApiError & { matches?: DuplicateCheckResult['matches'] };
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
  const response = await fetch(buildUrl('/api/health'));
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return response.json() as Promise<HealthResponse>;
}

export async function fetchMe(getToken: () => Promise<string | null>): Promise<MeResponse> {
  return fetchWithAuth<MeResponse>('/api/me', getToken);
}

// Leads API
export async function fetchLeads(
  getToken: () => Promise<string | null>,
  query: LeadListQuery = { page: 1, pageSize: 20 }
): Promise<PaginatedResponse<Lead>> {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.stage) params.set('stage', query.stage);
  if (query.source) params.set('source', query.source);
  if (query.search) params.set('search', query.search);

  return fetchWithAuth<PaginatedResponse<Lead>>(`/api/leads?${params.toString()}`, getToken);
}

export async function createLeadApi(
  getToken: () => Promise<string | null>,
  input: CreateLeadInput
): Promise<{ success: boolean; data: Lead }> {
  return fetchWithAuth<{ success: boolean; data: Lead }>('/api/leads', getToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function checkDuplicateLead(
  getToken: () => Promise<string | null>,
  params: { email?: string; phone?: string }
): Promise<DuplicateCheckResult> {
  const query = new URLSearchParams();
  if (params.email) query.set('email', params.email);
  if (params.phone) query.set('phone', params.phone);

  return fetchWithAuth<DuplicateCheckResult>(`/api/leads/check-duplicate?${query.toString()}`, getToken);
}

export async function updateLeadStageApi(
  getToken: () => Promise<string | null>,
  leadId: string,
  input: UpdateLeadStageInput
): Promise<{ success: boolean; data: Lead }> {
  return fetchWithAuth<{ success: boolean; data: Lead }>(`/api/leads/${leadId}/stage`, getToken, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchLeadDetail(
  getToken: () => Promise<string | null>,
  leadId: string
): Promise<LeadDetailResponse> {
  return fetchWithAuth<LeadDetailResponse>(`/api/leads/${leadId}`, getToken);
}

export async function addLeadNoteApi(
  getToken: () => Promise<string | null>,
  leadId: string,
  body: string
): Promise<{ success: boolean; data: LeadNote }> {
  return fetchWithAuth<{ success: boolean; data: LeadNote }>(`/api/leads/${leadId}/notes`, getToken, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function setLeadFollowUpApi(
  getToken: () => Promise<string | null>,
  leadId: string,
  nextFollowUpAt: number | null
): Promise<{ success: boolean; data: Lead }> {
  return fetchWithAuth<{ success: boolean; data: Lead }>(`/api/leads/${leadId}/follow-up`, getToken, {
    method: 'PATCH',
    body: JSON.stringify({ nextFollowUpAt }),
  });
}
