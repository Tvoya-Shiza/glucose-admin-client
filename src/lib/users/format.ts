/**
 * Display formatters for the users list/detail pages.
 *
 * `formatUnixDate` accepts the Unix-seconds shape returned by admin-api (created_at,
 * last_activity). Locale 'kz' is the URL convention; we remap to 'kk-KZ' at the
 * BCP-47 boundary per glucose-admin-client/CLAUDE.md ("If you need
 * Intl.PluralRules/Intl.DateTimeFormat, remap 'kz' -> 'kk-KZ' at the BCP-47 boundary.").
 */
export function formatUnixDate(unix: number | null, locale: string): string {
    if (!unix) return '—';
    const d = new Date(unix * 1000);
    const lang = locale === 'kz' ? 'kk-KZ' : 'ru-RU';
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(d);
}

/**
 * Resolve a `role_name` value to its `admin.users.*` i18n key. Unknown roles fall
 * back to the student label so the table cell never renders a raw English string.
 */
export function roleLabelKey(role: string): string {
    switch (role) {
        case 'admin':
        case 'curator':
        case 'teacher':
        case 'student':
            return `role_${role}`;
        default:
            return 'role_student';
    }
}

/**
 * Resolve a `status` value to its `admin.users.*` i18n key. Unknown statuses fall back
 * to inactive so the cell never renders a raw English string.
 */
export function statusLabelKey(status: string): string {
    switch (status) {
        case 'active':
        case 'inactive':
        case 'pending':
            return `status_${status}`;
        default:
            return 'status_inactive';
    }
}
