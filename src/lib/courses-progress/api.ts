import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type { ProgressReport, ProgressReportQuery } from './types';

const PROXY = '/api/proxy/v1/admin/courses';

function buildQuery(query: Record<string, unknown> | undefined): string {
    if (!query) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

export async function getProgressReport(
    courseId: number | string,
    query: ProgressReportQuery,
): Promise<ProgressReport> {
    const url = `${PROXY}/${encodeURIComponent(String(courseId))}/progress${buildQuery(query as unknown as Record<string, unknown>)}`;
    const res = await fetchWithRefresh(url);
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `getProgressReport failed: ${res.status}`;
        throw new Error(msg);
    }
    return (await res.json()) as ProgressReport;
}
