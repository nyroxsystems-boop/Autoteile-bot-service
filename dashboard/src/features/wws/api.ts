import { BOT_SERVICE_BASE_URL } from '../../config';

export type ProviderType = 'demo_wws' | 'http_api' | 'scraper';

export interface WwsConnection {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  isActive: boolean;
  authConfig?: any;
  config?: any;
}

export interface CreateWwsConnectionInput {
  name: string;
  type: ProviderType;
  baseUrl: string;
  isActive?: boolean;
  authConfig?: any;
  config?: any;
}

export interface UpdateWwsConnectionInput {
  name?: string;
  type?: ProviderType;
  baseUrl?: string;
  isActive?: boolean;
  authConfig?: any;
  config?: any;
}

export interface TestConnectionResponse {
  ok: boolean;
  error?: string;
  sampleResultsCount?: number;
}

const buildUrl = (path: string) =>
  path.startsWith('http') ? path : `${BOT_SERVICE_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = buildUrl(path);
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchConnections(): Promise<WwsConnection[]> {
  return request<WwsConnection[]>('/api/wws-connections');
}

export async function createConnection(input: CreateWwsConnectionInput): Promise<WwsConnection> {
  return request<WwsConnection>('/api/wws-connections', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function updateConnection(
  id: string,
  input: UpdateWwsConnectionInput
): Promise<WwsConnection> {
  return request<WwsConnection>(`/api/wws-connections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input)
  });
}

export async function deleteConnection(id: string): Promise<void> {
  await request(`/api/wws-connections/${id}`, { method: 'DELETE' });
}

export async function testConnection(id: string, oemNumber: string): Promise<TestConnectionResponse> {
  return request<TestConnectionResponse>(`/api/wws-connections/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ oemNumber })
  });
}

export async function testInventory(oemNumber: string) {
  return request<{ oemNumber: string; results: any[] }>(
    `/api/bot/inventory/by-oem/${encodeURIComponent(oemNumber)}`
  );
}
