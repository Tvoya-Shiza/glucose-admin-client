import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';

/**
 * Typed wrapper for GET /admin-api/v1/admin/courses/:id/picker-items.
 *
 * Backs the schedules editor item-picker (lesson / quiz / assignment / file).
 * Server scopes results to the given course, so consumers only need the
 * course id + kind + optional search.
 *
 * Mirrors admin-api `ListPickerItemsDto` + `PickerItemsResponseDto` —
 * keep this file in lockstep with that DTO.
 */

export type PickerItemKind = 'lesson' | 'quiz' | 'assignment' | 'file';

export interface PickerItem {
    id: number;
    title_kz: string | null;
    title_ru: string | null;
}

export interface PickerItemsResponse {
    rows: PickerItem[];
    total: number;
    page: number;
    page_size: number;
}

export async function fetchCoursePickerItems(
    courseId: number,
    kind: PickerItemKind,
    q?: string,
    page_size = 20,
    page = 1,
): Promise<PickerItemsResponse> {
    const params = new URLSearchParams({
        kind,
        page: String(page),
        page_size: String(page_size),
    });
    const needle = q?.trim() ?? '';
    if (needle.length > 0) params.set('q', needle);

    const res = await fetchWithRefresh(
        `/api/proxy/v1/admin/courses/${encodeURIComponent(String(courseId))}/picker-items?${params.toString()}`,
    );
    if (!res.ok) {
        throw new Error(`fetchCoursePickerItems failed: ${res.status}`);
    }
    return (await res.json()) as PickerItemsResponse;
}
