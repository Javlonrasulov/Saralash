import { apiFetch } from './api-client';
export async function fetchSharedAppState() {
    const res = await apiFetch('/app-state');
    if (!res.ok)
        throw new Error('APP_STATE_FETCH_FAILED');
    const data = (await res.json());
    return {
        payload: data.payload ?? null,
        updatedAt: data.updatedAt ?? null,
    };
}
export async function putSharedAppState(payload) {
    const res = await apiFetch('/app-state', {
        method: 'PUT',
        body: JSON.stringify({ payload }),
    });
    if (!res.ok)
        throw new Error('APP_STATE_PUT_FAILED');
    const data = (await res.json());
    return { updatedAt: data.updatedAt };
}
