import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    CreateSchedulePayload,
    Schedule,
    ScheduleAnalytics,
    ScheduleCalendarResponse,
    ScheduleListFilters,
    ScheduleListResponse,
    UpdateSchedulePayload,
} from './types';

const BASE = '/api/proxy/v1/admin/schedules';

function qs(params: Record<string, string | number | undefined | null>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v == null) continue;
        const str = typeof v === 'number' ? String(v) : v;
        if (str.length === 0) continue;
        sp.set(k, str);
    }
    const s = sp.toString();
    return s.length > 0 ? `?${s}` : '';
}

export async function listSchedules(filters: ScheduleListFilters): Promise<ScheduleListResponse> {
    const res = await fetchWithRefresh(`${BASE}${qs(filters as Record<string, string | number | undefined>)}`);
    if (!res.ok) throw new Error(`list schedules failed: ${res.status}`);
    return (await res.json()) as ScheduleListResponse;
}

export async function getScheduleCalendar(args: {
    from: number;
    to: number;
    curator_id?: number;
    group_id?: number;
    course_id?: number;
    status?: string;
}): Promise<ScheduleCalendarResponse> {
    const res = await fetchWithRefresh(`${BASE}/calendar${qs(args)}`);
    if (!res.ok) throw new Error(`calendar failed: ${res.status}`);
    return (await res.json()) as ScheduleCalendarResponse;
}

export async function getScheduleAnalytics(args: { from?: number; to?: number }): Promise<ScheduleAnalytics> {
    const res = await fetchWithRefresh(`${BASE}/analytics${qs(args)}`);
    if (!res.ok) throw new Error(`analytics failed: ${res.status}`);
    return (await res.json()) as ScheduleAnalytics;
}

export async function getSchedule(id: number): Promise<Schedule> {
    const res = await fetchWithRefresh(`${BASE}/${id}`);
    if (!res.ok) throw new Error(`get schedule failed: ${res.status}`);
    return (await res.json()) as Schedule;
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<{ id: number }> {
    const res = await fetchWithRefresh(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { trans?: string; message?: string };
        throw new Error(err.trans ?? err.message ?? `create failed: ${res.status}`);
    }
    return (await res.json()) as { id: number };
}

export async function updateSchedule(id: number, payload: UpdateSchedulePayload): Promise<{ id: number }> {
    const res = await fetchWithRefresh(`${BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { trans?: string; message?: string };
        throw new Error(err.trans ?? err.message ?? `update failed: ${res.status}`);
    }
    return (await res.json()) as { id: number };
}

export async function deleteSchedule(id: number): Promise<{ id: number; deleted: boolean }> {
    const res = await fetchWithRefresh(`${BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`delete failed: ${res.status}`);
    return (await res.json()) as { id: number; deleted: boolean };
}
