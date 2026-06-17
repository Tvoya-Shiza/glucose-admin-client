import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';

/**
 * Typed wrapper for GET /admin-api/v1/admin/courses/:id/picker-items.
 *
 * Backs the item-picker (lesson / quiz / assignment / file) for both the
 * schedules editor and the course-content editor.
 *
 * `scope` only matters for kind='quiz' (quizzes are global, with no course FK):
 * 'course' (default) returns quizzes already attached to the course (schedules);
 * 'all' returns the whole quiz catalog (content editor, attach flow).
 *
 * Mirrors admin-api `ListPickerItemsDto` + `PickerItemsResponseDto` —
 * keep this file in lockstep with that DTO.
 */

export type PickerItemKind = 'lesson' | 'quiz' | 'assignment' | 'file';
export type PickerItemScope = 'course' | 'all';

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
    opts?: { page?: number; page_size?: number; scope?: PickerItemScope },
): Promise<PickerItemsResponse> {
    const params = new URLSearchParams({
        kind,
        page: String(opts?.page ?? 1),
        page_size: String(opts?.page_size ?? 20),
    });
    const needle = q?.trim() ?? '';
    if (needle.length > 0) params.set('q', needle);
    // Default is 'course' server-side; only send the param when overriding.
    if (opts?.scope === 'all') params.set('scope', 'all');

    const res = await fetchWithRefresh(
        `/api/proxy/v1/admin/courses/${encodeURIComponent(String(courseId))}/picker-items?${params.toString()}`,
    );
    if (!res.ok) {
        throw new Error(`fetchCoursePickerItems failed: ${res.status}`);
    }
    return (await res.json()) as PickerItemsResponse;
}
