/**
 * Unix-seconds ↔ `<input type='datetime-local'>` converters for the trainer
 * availability window (Phase 38), plus an elapsed mm:ss formatter for results.
 *
 * The availability window is authored in the operator's local wall-clock time
 * (Asia/Almaty in practice) and stored as Unix seconds — the naive local
 * interpretation is intentional and sufficient (mirrors credits/format.ts
 * toDatetimeLocal/fromDatetimeLocal). No timezone math is applied: the same
 * `Date` the browser renders in the input is the one converted to seconds.
 */

/** Unix seconds → `<input type='datetime-local'>` value ('' when null/undefined). */
export function unixToLocalInput(sec: number | null | undefined): string {
    if (sec == null) return '';
    const d = new Date(sec * 1000);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `<input type='datetime-local'>` value → Unix seconds (null when empty/invalid). */
export function localInputToUnix(value: string | null | undefined): number | null {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/** Elapsed seconds → `mm:ss` (clamped at 0; hours fold into minutes, e.g. 90:05). */
export function formatElapsed(totalSeconds: number | null | undefined): string {
    const s = Math.max(0, Math.floor(totalSeconds ?? 0));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
