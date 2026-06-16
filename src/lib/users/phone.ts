/**
 * KZ phone formatting helpers (client-side UX layer).
 *
 * The admin-api `normalizeKzPhone()` is the security gate — it accepts
 * `+7XXXXXXXXXX | 8XXXXXXXXXX | 7XXXXXXXXXX` and stores the canonical
 * `+7XXXXXXXXXX`. These helpers exist purely so the operator sees and types a
 * `+7 (777) 777-77-77` mask, while the form value stays canonical so it submits
 * exactly what the server expects. No external mask library (none is installed).
 *
 * Model: a KZ number is country code `7` + 10 subscriber digits. A leading `8`
 * (domestic trunk prefix) is normalized to `7`. Anything past 10 subscriber
 * digits is dropped — this is what fixes inputs like `7777777777777`.
 */

/** Extract digits and normalize to a leading country code `7`, capped at 11 digits. */
function normalizeDigits(raw: string): string {
    let d = (raw ?? '').replace(/\D/g, '');
    if (d.length === 0) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    return d.slice(0, 11); // 7 (country) + up to 10 subscriber digits
}

/**
 * Format arbitrary input into the progressive mask `+7 (XXX) XXX-XX-XX`.
 * Returns '' for empty input so an optional field can stay blank.
 */
export function formatPhoneMask(raw: string): string {
    const d = normalizeDigits(raw);
    if (d.length === 0) return '';
    const sub = d.slice(1); // up to 10 subscriber digits
    let out = '+7';
    if (sub.length > 0) out += ' (' + sub.slice(0, 3);
    if (sub.length >= 3) out += ')';
    if (sub.length > 3) out += ' ' + sub.slice(3, 6);
    if (sub.length > 6) out += '-' + sub.slice(6, 8);
    if (sub.length > 8) out += '-' + sub.slice(8, 10);
    return out;
}

/**
 * Canonical form for submit / form state: `+7XXXXXXXXXX` (or '' when empty).
 * While typing it returns a partial `+712…`; the zod regex on the form rejects
 * anything that is not a full `+7` + 10 digits, so partial input can't be saved.
 */
export function toCanonicalPhone(raw: string): string {
    const d = normalizeDigits(raw);
    return d.length === 0 ? '' : '+' + d;
}

/** Format a stored canonical phone for read-only display; '' stays ''. */
export function formatPhoneDisplay(mobile: string | null | undefined): string {
    if (!mobile) return '';
    return formatPhoneMask(mobile);
}
