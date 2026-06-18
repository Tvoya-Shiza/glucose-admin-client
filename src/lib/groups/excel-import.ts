import type { ResolveRowInput } from './types';

/**
 * Client-side .xlsx parsing + template generation for the group member import (GRP-07).
 *
 * The browser parses the uploaded workbook with exceljs (already a dependency) and
 * extracts { name, phone } rows by HEADER (product chose a fixed template with headers).
 * A small alias list tolerates ru/kz header wording and a few common synonyms so a
 * sheet authored in either locale still parses.
 *
 * exceljs is dynamically imported so it stays out of the initial route bundle.
 */

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB (mirrors users/csv.ts)
const MAX_ROWS = 2000; // matches admin-api ResolveMembersDto @ArrayMaxSize(2000)

// Header aliases, lowercased + whitespace-collapsed. Template headers come first.
const NAME_HEADERS = [
    'имя фамилия',
    'фио',
    'имя',
    'имя и фамилия',
    'аты жөні',
    'аты-жөні',
    'аты тегі',
    'аты',
    'name',
    'full name',
    'full_name',
];
const PHONE_HEADERS = [
    'телефон',
    'номер телефона',
    'номер',
    'тел',
    'телефон нөмірі',
    'нөмір',
    'ұялы телефон',
    'phone',
    'mobile',
];

export interface ParsedImport {
    /** Rows with at least one non-empty field (these get sent to the resolve endpoint). */
    rows: ResolveRowInput[];
    /** Count of all non-empty data rows seen (excludes the header + blank rows). */
    totalDataRows: number;
    /** Data rows that had content but neither a name nor a phone (skipped, not sent). */
    emptyRows: number;
}

export class ImportParseError extends Error {}

/** Robustly extract a trimmed string from any exceljs cell value (string/number/rich/formula/hyperlink). */
function cellText(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value).trim();
    if (value instanceof Date) return '';
    if (typeof value === 'object') {
        const v = value as Record<string, unknown>;
        if (typeof v.text === 'string') return v.text.trim();
        if (Array.isArray(v.richText)) return (v.richText as Array<{ text?: string }>).map((t) => t.text ?? '').join('').trim();
        if (v.result != null) return String(v.result).trim();
    }
    return String(value).trim();
}

const headerKey = (raw: unknown): string => cellText(raw).replace(/\s+/g, ' ').toLowerCase();

/**
 * Parse an uploaded .xlsx into resolvable rows. Throws ImportParseError on validation
 * problems (size, missing headers, too many rows) — callers map `.message` to i18n.
 */
export async function parseImportXlsx(file: File): Promise<ParsedImport> {
    if (file.size > MAX_FILE_BYTES) throw new ImportParseError('file_too_large');

    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    try {
        await wb.xlsx.load(await file.arrayBuffer());
    } catch {
        throw new ImportParseError('parse_failed');
    }

    const ws = wb.worksheets[0];
    if (!ws) throw new ImportParseError('no_sheet');

    // Locate the name + phone columns from the header row.
    let nameCol = -1;
    let phoneCol = -1;
    ws.getRow(1).eachCell((cell, col) => {
        const key = headerKey(cell.value);
        if (nameCol === -1 && NAME_HEADERS.includes(key)) nameCol = col;
        if (phoneCol === -1 && PHONE_HEADERS.includes(key)) phoneCol = col;
    });
    if (nameCol === -1 && phoneCol === -1) throw new ImportParseError('headers_not_found');

    const rows: ResolveRowInput[] = [];
    let totalDataRows = 0;
    let emptyRows = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // header
        const name = nameCol > 0 ? cellText(row.getCell(nameCol).value) : '';
        const phone = phoneCol > 0 ? cellText(row.getCell(phoneCol).value) : '';
        totalDataRows++;
        if (!name && !phone) {
            emptyRows++;
            return;
        }
        if (rows.length >= MAX_ROWS) throw new ImportParseError('too_many_rows');
        rows.push({ name: name || undefined, phone: phone || undefined });
    });

    if (rows.length === 0) throw new ImportParseError('no_data_rows');

    return { rows, totalDataRows, emptyRows };
}

function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Generate + download the import template (.xlsx) with the two header columns and a
 * couple of example rows. Header labels + filename are passed in from i18n.
 */
export async function downloadImportTemplate(opts: {
    nameHeader: string;
    phoneHeader: string;
    sheetName: string;
    filename: string;
}): Promise<void> {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(opts.sheetName);
    ws.columns = [
        { header: opts.nameHeader, key: 'name', width: 32 },
        { header: opts.phoneHeader, key: 'phone', width: 22 },
    ];
    ws.getRow(1).font = { bold: true };
    // Keep the phone column as text so Excel doesn't reformat +7… into a number.
    ws.getColumn('phone').numFmt = '@';
    ws.addRow({ name: 'Иван Иванов', phone: '+77071234567' });
    ws.addRow({ name: '', phone: '77071234567' });
    ws.addRow({ name: 'Пётр Петров', phone: '' });
    const ab = await wb.xlsx.writeBuffer();
    triggerDownload(new Blob([ab], { type: XLSX_MIME }), opts.filename);
}
