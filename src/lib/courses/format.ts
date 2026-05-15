/**
 * Display formatters for the courses list/detail pages (Phase 5 Plan 02).
 *
 * Mirrors src/lib/groups/format.ts where possible; courses-specific helpers
 * (slugify, course-status badge variant) live here.
 */

import type { CourseStatus } from './types';

/**
 * Format a Unix-seconds timestamp into a localized medium-style date, or '—' if null.
 *
 * Locale 'kz' is the URL convention; remap to 'kk-KZ' at the BCP-47 boundary
 * (per glucose-admin-client/CLAUDE.md).
 */
export function formatUnixSecondsOrDash(value: number | null | undefined, locale: string): string {
    if (value == null) return '—';
    const d = new Date(value * 1000);
    const lang = locale === 'kz' ? 'kk-KZ' : 'ru-RU';
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(d);
}

/**
 * shadcn Badge variant for a Webinar's status (CONTEXT D-01 status set).
 *   - active   -> default (primary)
 *   - pending  -> secondary
 *   - is_draft -> outline
 *   - inactive -> destructive
 */
export function statusBadgeVariant(
    status: CourseStatus,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'active':
            return 'default';
        case 'pending':
            return 'secondary';
        case 'is_draft':
            return 'outline';
        case 'inactive':
            return 'destructive';
        default:
            return 'outline';
    }
}

/**
 * Simple deterministic slug transliteration for Russian + Kazakh text.
 *
 * NOT a linguistic romanization — just enough to produce a kebab-case URL slug
 * from a human-typed RU/KZ title. Used by CreateCourseDialog to auto-fill the slug
 * field from the RU title; the user can manually override.
 *
 * Pipeline:
 *   1. Map cyrillic + KZ-specific letters to Latin equivalents.
 *   2. Lowercase + replace any non-alphanum with `-`.
 *   3. Collapse repeated `-`.
 *   4. Trim leading/trailing `-`.
 *
 * Empty input returns ''. Idempotent on already-slugified input.
 */
const CYRILLIC_MAP: Record<string, string> = {
    // Russian
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    // Kazakh-specific
    ң: 'ng', ұ: 'u', ө: 'o', ә: 'a', ғ: 'g', қ: 'q', і: 'i', һ: 'h', ү: 'u',
};

export function slugify(input: string): string {
    if (!input) return '';
    const lower = input.toLowerCase();
    let out = '';
    for (const ch of lower) {
        if (CYRILLIC_MAP[ch] !== undefined) {
            out += CYRILLIC_MAP[ch];
        } else if (/[a-z0-9]/.test(ch)) {
            out += ch;
        } else {
            out += '-';
        }
    }
    return out.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Validate that a string already conforms to the kebab-case slug shape
 * accepted by admin-api's CreateCourseDto / UpdateCourseDto: 3-255 chars,
 * lowercase letters / digits / hyphens, no leading or trailing hyphens.
 */
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
