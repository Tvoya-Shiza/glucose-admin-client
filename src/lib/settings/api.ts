import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type { UbtDateSettings } from './types';

const BASE = '/api/proxy/v1/admin/settings';

interface Envelope<T> {
    success: boolean;
    status: string;
    message: string;
    data?: T;
}

export async function getUbtDate(): Promise<UbtDateSettings> {
    const res = await fetchWithRefresh(`${BASE}/ubt-date`);
    if (!res.ok) throw new Error(`get ubt-date failed: ${res.status}`);
    const json = (await res.json()) as Envelope<UbtDateSettings>;
    return json.data ?? { date: '' };
}

export async function updateUbtDate(date: string): Promise<UbtDateSettings> {
    const res = await fetchWithRefresh(`${BASE}/ubt-date`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
    });
    if (!res.ok) throw new Error(`update ubt-date failed: ${res.status}`);
    const json = (await res.json()) as Envelope<UbtDateSettings>;
    return json.data ?? { date };
}

/** Almaty offset — the countdown timer's timezone convention (KZ is single-zone UTC+5). */
export const ALMATY_OFFSET = '+05:00';

/** "2027-05-11T00:00:00+05:00" → "2027-05-11" for an `<input type="date">`. */
export function toDateInput(iso: string): string {
    return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : '';
}

/** "2027-05-11" → "2027-05-11T00:00:00+05:00" for storage (midnight Almaty time). */
export function fromDateInput(date: string): string {
    return `${date}T00:00:00${ALMATY_OFFSET}`;
}
