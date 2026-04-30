/**
 * Display formatters for the groups list/detail pages.
 *
 * `formatUnixSecondsOrDash` accepts the Unix-seconds shape returned by admin-api but
 * gracefully renders '—' for nulls. GroupRow.created_at is ALWAYS null in Phase 4
 * (Group has no created_at column — Plan 01 schema-gap note); the helper isolates the
 * "—" fallback behind one call site so future schema landings are a one-line change.
 *
 * Locale 'kz' is the URL convention; remap to 'kk-KZ' at the BCP-47 boundary per
 * glucose-admin-client/CLAUDE.md.
 */
export function formatUnixSecondsOrDash(value: number | null | undefined, locale: 'ru' | 'kz'): string {
    if (value == null) return '—';
    const d = new Date(value * 1000);
    const lang = locale === 'kz' ? 'kk-KZ' : 'ru-RU';
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(d);
}

/**
 * Bucket key resolver for member-count filter labels (admin.groups.member_count_*).
 * Mirrors the server-side bucket boundaries in admin-api groups-list.service.ts.
 *   - 0       -> 'zero'
 *   - 1..25   -> 'small'
 *   - 26..50  -> 'medium'
 *   - 51+     -> 'large'
 */
export function memberCountBucketKey(count: number): 'zero' | 'small' | 'medium' | 'large' {
    if (count === 0) return 'zero';
    if (count <= 25) return 'small';
    if (count <= 50) return 'medium';
    return 'large';
}

/**
 * shadcn Badge variant for a Group's status — green-ish 'default' for active, muted
 * 'secondary' for inactive. Keeps the table cell styling consistent across list +
 * detail page (Plan 03 will reuse this).
 */
export function statusBadgeVariant(status: 'active' | 'inactive'): 'default' | 'secondary' {
    return status === 'active' ? 'default' : 'secondary';
}
