import type { PageInput, StockPage, SyncStatus } from '../shared/types';
export async function api<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(path, { signal, method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(value.error ?? 'Could not complete the request. Try again.');
  return value;
}
export const fetchPage = (input: PageInput, signal?: AbortSignal) => api<StockPage>('/api/stock/page', signal, input);
export const fetchStatus = (signal?: AbortSignal) => api<SyncStatus>('/api/status', signal);
