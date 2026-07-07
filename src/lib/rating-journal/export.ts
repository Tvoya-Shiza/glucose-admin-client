import type { JournalGrid } from './types';

/**
 * Client-side export of the rating-journal grid to .xlsx and .pdf.
 *
 * Both libraries are dynamically imported so they stay out of the initial route
 * bundle (mirrors lib/groups/excel-import.ts and lib/quizzes/api.ts). Only the
 * VISIBLE (non-hidden) columns are rendered, in position order, plus the ЖАЛПЫ
 * total column.
 */

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ExportLabels {
    /** ФИО column header. */
    studentHeader: string;
    /** ЖАЛПЫ / total column header. */
    totalHeader: string;
    /** Worksheet / document title (usually the journal title). */
    title: string;
}

interface GridView {
    columns: JournalGrid['columns'];
    header: string[];
    body: (string | number)[][];
}

/** Build the visible column set + a rectangular header/body view of the grid. */
function buildView(grid: JournalGrid, labels: ExportLabels): GridView {
    const columns = grid.columns.filter((c) => !c.is_hidden).sort((a, b) => a.position - b.position);

    const header = [labels.studentHeader, ...columns.map((c) => `${c.title} (${c.max_score})`), `${labels.totalHeader} (${grid.max_total})`];

    const body: (string | number)[][] = grid.rows.map((row) => {
        const cells: (string | number)[] = [row.full_name ?? `#${row.student_id}`];
        for (const col of columns) {
            const cell = row.cells[col.id];
            cells.push(cell && cell.value != null ? cell.value : '');
        }
        cells.push(row.total);
        return cells;
    });

    return { columns, header, body };
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

/** Render the grid to a single-worksheet .xlsx workbook and trigger a download. */
export async function exportGridXlsx(grid: JournalGrid, labels: ExportLabels): Promise<void> {
    const { header, body } = buildView(grid, labels);

    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(labels.title.slice(0, 31) || 'Journal');

    const headerRow = ws.addRow(header);
    headerRow.font = { bold: true };

    for (const row of body) {
        ws.addRow(row);
    }

    // Reasonable column widths: wide ФИО, medium score columns.
    ws.columns.forEach((col, idx) => {
        col.width = idx === 0 ? 32 : 14;
    });

    const ab = await wb.xlsx.writeBuffer();
    const ts = Math.floor(Date.now() / 1000);
    triggerDownload(new Blob([ab], { type: XLSX_MIME }), `rating-journal-${ts}.xlsx`);
}

/** Render the grid to a table .pdf (jspdf + jspdf-autotable) and trigger a download. */
export async function exportGridPdf(grid: JournalGrid, labels: ExportLabels): Promise<void> {
    const { header, body } = buildView(grid, labels);

    const { jsPDF } = await import('jspdf');
    const { autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(14);
    doc.text(labels.title, 40, 40);

    autoTable(doc, {
        head: [header],
        body: body.map((row) => row.map((cell) => (cell === '' ? '' : String(cell)))),
        startY: 56,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235] },
    });

    const ts = Math.floor(Date.now() / 1000);
    triggerDownload(doc.output('blob'), `rating-journal-${ts}.pdf`);
}
