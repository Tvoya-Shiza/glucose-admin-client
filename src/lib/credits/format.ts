/**
 * Display + input formatters for the credits pages (Phase 34).
 * Locale 'kz' is the URL convention; remap to 'kk-KZ' at the BCP-47 boundary
 * (per glucose-admin-client/CLAUDE.md).
 */

import type { Chapter, ChapterItem } from '@/lib/courses/types';

export function formatUnixDateTimeOrDash(value: number | null | undefined, locale: string): string {
    if (value == null) return '—';
    const d = new Date(value * 1000);
    const lang = locale === 'kz' ? 'kk-KZ' : 'ru-RU';
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

/** Unix seconds → `<input type='datetime-local'>` value ('' when null). */
export function toDatetimeLocal(unix: number | null | undefined): string {
    if (unix == null) return '';
    const d = new Date(unix * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `<input type='datetime-local'>` value → unix seconds (undefined when empty/invalid). */
export function fromDatetimeLocal(value: string): number | undefined {
    if (!value) return undefined;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

/** `<input type='date'>` value → unix seconds at local midnight (undefined when empty). */
export function fromDateInputStart(value: string | null | undefined): number | undefined {
    if (!value) return undefined;
    const ms = new Date(`${value}T00:00:00`).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

/** `<input type='date'>` value → unix seconds at local end-of-day (undefined when empty). */
export function fromDateInputEnd(value: string | null | undefined): number | undefined {
    const start = fromDateInputStart(value);
    return start === undefined ? undefined : start + 86399;
}

/** mm:ss countdown label (clamped at 0). */
export function formatCountdown(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** KZ display title for a course chapter (fallback `#id`). */
export function chapterDisplayTitle(chapter: Chapter): string {
    const title = chapter.translations.find((tr) => tr.locale === 'kz')?.title?.trim();
    return title && title.length > 0 ? title : `#${chapter.id}`;
}

/** KZ display title for a chapter item (file/pdf/assignment/quiz fallbacks, then `#id`). */
export function chapterItemDisplayTitle(item: ChapterItem): string {
    const fromTranslations = item.translations.find((tr) => tr.locale === 'kz')?.title?.trim();
    if (fromTranslations && fromTranslations.length > 0) return fromTranslations;
    const pdfTitle = item.pdfs?.[0]?.title?.trim();
    if (pdfTitle && pdfTitle.length > 0) return pdfTitle;
    if (item.assignment?.title && item.assignment.title.trim().length > 0) return item.assignment.title;
    if (item.quiz) return item.quiz.slug;
    return `#${item.id}`;
}
