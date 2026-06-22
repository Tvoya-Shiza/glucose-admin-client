function bcp47(locale: string): string {
    return locale === 'kz' ? 'kk-KZ' : 'ru-RU';
}

export function formatScheduleRange(startSec: number, endSec: number, locale: string): string {
    const start = new Date(startSec * 1000);
    const end = new Date(endSec * 1000);
    const lang = bcp47(locale);
    const sameDay =
        start.getFullYear() === end.getFullYear() &&
        start.getMonth() === end.getMonth() &&
        start.getDate() === end.getDate();
    const dateFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' });
    const timeFmt = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
    if (sameDay) {
        return `${dateFmt.format(start)}, ${timeFmt.format(start)}–${timeFmt.format(end)}`;
    }
    const dtFmt = new Intl.DateTimeFormat(lang, {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
    });
    return `${dtFmt.format(start)} → ${dtFmt.format(end)}`;
}

export function formatScheduleDate(unixSec: number, locale: string): string {
    return new Intl.DateTimeFormat(bcp47(locale), { dateStyle: 'medium' }).format(new Date(unixSec * 1000));
}

export function formatScheduleTime(unixSec: number, locale: string): string {
    return new Intl.DateTimeFormat(bcp47(locale), { hour: '2-digit', minute: '2-digit' }).format(new Date(unixSec * 1000));
}

/**
 * Strip HTML tags from a (possibly rich-text) description down to plain text.
 * Used for compact surfaces — table previews, calendar tooltips, delete
 * confirmation — where rendered markup would be noise. The full rich content is
 * shown in the editor (admin) and the student schedule card.
 */
export function htmlToPlainText(html: string | null | undefined): string {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

export function unixSecondsAtStartOfDay(year: number, month0: number, day: number): number {
    return Math.floor(new Date(year, month0, day, 0, 0, 0, 0).getTime() / 1000);
}

export function unixSecondsAtEndOfDay(year: number, month0: number, day: number): number {
    return Math.floor(new Date(year, month0, day, 23, 59, 59, 999).getTime() / 1000);
}

/**
 * Convert a `<input type="datetime-local">` value (interpreted in local TZ)
 * to unix seconds. Empty string → null.
 */
export function datetimeLocalToUnix(value: string): number | null {
    if (!value || value.length === 0) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return Math.floor(d.getTime() / 1000);
}

/**
 * Inverse of datetimeLocalToUnix — produces a 'YYYY-MM-DDTHH:mm' value
 * for <input type="datetime-local"> in local TZ.
 */
export function unixToDatetimeLocal(unixSec: number | null | undefined): string {
    if (unixSec == null) return '';
    const d = new Date(unixSec * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
