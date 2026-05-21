import { apiFetch } from './api-client';

export type SharedAppStateResponse = {
  payload: unknown;
  updatedAt: string | null;
};

export async function fetchSharedAppState(): Promise<SharedAppStateResponse> {
  const res = await apiFetch('/app-state');
  if (!res.ok) throw new Error('APP_STATE_FETCH_FAILED');
  const data = (await res.json()) as SharedAppStateResponse;
  return {
    payload: data.payload ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function putSharedAppState(payload: unknown): Promise<{ updatedAt: string }> {
  const res = await apiFetch('/app-state', {
    method: 'PUT',
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error('APP_STATE_PUT_FAILED');
  const data = (await res.json()) as { updatedAt: string };
  return { updatedAt: data.updatedAt };
}
