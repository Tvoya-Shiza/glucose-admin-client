'use client';

import { useLocale } from 'next-intl';

/**
 * Phase 9 ANL-04 (D-14) — "as of N minutes ago" staleness banner.
 *
 * Each analytics endpoint returns `snapshot_at` (Unix sec). With the 5-minute
 * server-side cache, surfacing the actual snapshot age tells operators how
 * fresh the numbers really are.
 *
 * Locale handling: our URL convention uses 'kz' but Intl APIs require BCP-47
 * 'kk-KZ'. Documented in admin-client CLAUDE.md ("remap 'kz' → 'kk-KZ' at the
 * BCP-47 boundary"). T-09-05-04 mitigation.
 */
interface Props {
    /** Unix seconds. */
    snapshotAt: number;
}

export function SnapshotStaleness({ snapshotAt }: Props) {
    const locale = useLocale();
    const intlLocale = locale === 'kz' ? 'kk-KZ' : locale;
    const now = Math.floor(Date.now() / 1000);
    const deltaSec = Math.max(0, now - snapshotAt);

    let label: string;
    try {
        const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' });
        if (deltaSec < 60) label = rtf.format(-deltaSec, 'second');
        else if (deltaSec < 3600) label = rtf.format(-Math.floor(deltaSec / 60), 'minute');
        else label = rtf.format(-Math.floor(deltaSec / 3600), 'hour');
    } catch {
        // Fallback for any locale RTF doesn't support — render a plain delta.
        label = `${Math.floor(deltaSec / 60)}m ago`;
    }
    return <p className='text-muted-foreground text-xs whitespace-nowrap'>{label}</p>;
}
