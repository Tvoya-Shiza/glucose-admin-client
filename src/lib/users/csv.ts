import Papa from 'papaparse';

/**
 * USR-06 — CSV parse + error-report helpers.
 *
 * Plan 06 D-16: parsing happens client-side with hard caps (5MB raw / 10k data rows)
 * before bytes hit the network — DoS protection at the trust boundary (T-03-52).
 *
 * Plan 06 D-18: error-report download mirrors the upload shape and adds `status` + `reason`.
 * The Blob is constructed in the browser; no server round-trip — admins can re-upload
 * the report after fixing the flagged rows.
 *
 * Reference-implementation note: Phase 7 (Stories/Banners/Blogs CSV imports, if any)
 * may reuse `parseCsvFile` verbatim. `buildErrorReportCsv` accepts a generic row shape
 * via the columns parameter; current shape is locked to users for v1.
 */

export interface CsvParseResult {
    rows: Array<Record<string, string>>;
    errors: Papa.ParseError[];
}

/**
 * Parse a CSV File client-side. Caps: 5MB raw + 10_000 data rows.
 * Returns rows as `Record<string, string>` keyed by header (lowercased + trimmed).
 *
 * Throws:
 *   - `csv_too_large_5mb` — raw byte size exceeds the 5MB cap (T-03-52).
 *   - `csv_too_many_rows_10000` — parsed data rows exceed the 10k cap.
 */
export async function parseCsvFile(file: File): Promise<CsvParseResult> {
    const MAX_SIZE = 5 * 1024 * 1024;
    const MAX_ROWS = 10_000;
    if (file.size > MAX_SIZE) throw new Error('csv_too_large_5mb');
    const text = await file.text();
    const out = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h.trim().toLowerCase(),
    });
    if (out.data.length > MAX_ROWS) throw new Error('csv_too_many_rows_10000');
    return { rows: out.data, errors: out.errors };
}

export interface ErrorReportRow {
    row_id: string;
    full_name?: string;
    email?: string;
    mobile?: string;
    role_name?: string;
    status: 'insert' | 'update' | 'skip' | 'error';
    reason: string | null;
}

/**
 * Build a CSV Blob mirroring the uploaded shape + extra `status` + `reason` columns.
 *
 * RFC 4180-ish escaping: any cell containing a comma, double-quote, or newline is
 * wrapped in double quotes, with embedded `"` doubled. Suitable for re-upload —
 * `parseCsvFile` round-trips this output without loss.
 *
 * Note: CSV formula injection (cells starting with `=`) is NOT defended here;
 * out-of-scope for v1 per threat-model T-03-56. Phase 7 may add a `'` prefix to
 * leading-`=` cells if needed.
 */
export function buildErrorReportCsv(rows: ErrorReportRow[]): Blob {
    const header = ['row_id', 'full_name', 'email', 'mobile', 'role_name', 'status', 'reason'];
    const escape = (v: string | undefined | null): string => {
        if (v == null) return '';
        const s = String(v);
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    const lines: string[] = [header.join(',')];
    for (const r of rows) {
        lines.push(
            [r.row_id, r.full_name, r.email, r.mobile, r.role_name, r.status, r.reason ?? '']
                .map(escape)
                .join(','),
        );
    }
    return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
}
