import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';

export interface NotificationRow {
    id: string;
    user_id: number;
    category: string;
    payload: Record<string, unknown>;
    is_read: boolean;
    read_at: number | null;
    created_at: number;
}

export interface NotificationListResponse {
    rows: NotificationRow[];
    total: number;
    page: number;
    page_size: number;
    unread_count: number;
}

const BASE = '/api/proxy/v1/admin/notifications';

export async function listNotifications(unreadOnly = false, page = 1, page_size = 30): Promise<NotificationListResponse> {
    const qs = new URLSearchParams();
    if (unreadOnly) qs.set('unread_only', 'true');
    qs.set('page', String(page));
    qs.set('page_size', String(page_size));
    const res = await fetchWithRefresh(`${BASE}?${qs.toString()}`);
    if (!res.ok) throw new Error(`listNotifications failed: ${res.status}`);
    return res.json();
}

export async function getUnreadCount(): Promise<{ unread_count: number }> {
    const res = await fetchWithRefresh(`${BASE}/unread-count`);
    if (!res.ok) throw new Error(`unreadCount failed: ${res.status}`);
    const json = await res.json();
    return (json?.data ?? json) as { unread_count: number };
}

export async function markRead(id: string): Promise<{ ok: true }> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
    if (!res.ok) throw new Error(`markRead failed: ${res.status}`);
    const json = await res.json();
    return (json?.data ?? json) as { ok: true };
}

export async function markAllRead(): Promise<{ ok: true; updated: number }> {
    const res = await fetchWithRefresh(`${BASE}/read-all`, { method: 'PATCH' });
    if (!res.ok) throw new Error(`markAllRead failed: ${res.status}`);
    const json = await res.json();
    return (json?.data ?? json) as { ok: true; updated: number };
}
