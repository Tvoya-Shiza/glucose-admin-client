/**
 * «Рейтинг-журнал» (rating journal / gradebook) — admin-client types.
 *
 * Mirrors the admin-api surface. Journal-domain ids (journal, columns) are BigInt
 * in MySQL and serialized as STRINGS by the admin-api interceptor — typed as
 * `string` here and NEVER passed through `Number()`. Student / group / course /
 * chapter ids remain numbers.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Grid
// ──────────────────────────────────────────────────────────────────────────────

export type JournalSourceKind = 'module_quiz' | 'module_assignment' | 'attendance' | 'credit' | 'custom';

export interface JournalColumn {
    id: string;
    title: string;
    source_kind: JournalSourceKind;
    source_ref_id: string | null;
    chapter_id: number | null;
    max_score: number;
    position: number;
    is_hidden: boolean;
    /** Auto-populated (quiz/assignment/attendance/credit) — read-only unless overridden. */
    is_auto: boolean;
    /** Manually-created column — editable title/max_score, deletable. */
    is_custom: boolean;
}

export interface JournalCell {
    column_id: string;
    value: number | null;
    is_manual_override: boolean;
}

export interface JournalRow {
    student_id: number;
    full_name: string | null;
    /** Keyed by column id (string). */
    cells: Record<string, JournalCell>;
    total: number;
}

export interface JournalRef {
    id: string;
    group_id: number;
    course_id: number;
    title: string;
}

export interface JournalGrid {
    journal: JournalRef;
    columns: JournalColumn[];
    rows: JournalRow[];
    max_total: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Journal list / create
// ──────────────────────────────────────────────────────────────────────────────

export interface JournalListRow {
    id: string;
    group_id: number;
    course_id: number;
    title: string;
    created_at: number;
}

export interface ListJournalsQuery {
    group_id?: number;
    course_id?: number;
    page?: number;
    page_size?: number;
}

export interface JournalListResponse {
    rows: JournalListRow[];
    total: number;
    pageCount: number;
}

export interface CreateJournalPayload {
    group_id: number;
    course_id: number;
    title?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Columns
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateColumnPayload {
    journal_id: string;
    title: string;
    /** Only manual kinds may be created from the UI. */
    source_kind?: 'custom' | 'attendance';
    max_score: number;
    chapter_id?: number;
    position?: number;
}

export interface UpdateColumnPayload {
    title?: string;
    max_score?: number;
    is_hidden?: boolean;
}

export interface ReorderColumnEntry {
    id: string;
    position: number;
}

export interface ReorderColumnsPayload {
    order: ReorderColumnEntry[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Cells
// ──────────────────────────────────────────────────────────────────────────────

export interface UpdateCellPayload {
    column_id: string;
    student_id: number;
    value?: number | null;
    /** Clears the manual override, reverting to the auto value. */
    reset?: boolean;
}

export interface UpdatedCell {
    column_id: string;
    student_id: number;
    value: number | null;
    is_manual_override: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Edit log (history)
// ──────────────────────────────────────────────────────────────────────────────

export interface JournalCellHistoryRow {
    id: string;
    column_id: string;
    student_id: number;
    old_value: number | null;
    new_value: number | null;
    source: string;
    changed_by: string | null;
    changed_at: number;
}

export interface ListCellHistoryQuery {
    column_id: string;
    student_id: number;
    page?: number;
    page_size?: number;
}

export interface CellHistoryListResponse {
    rows: JournalCellHistoryRow[];
    total: number;
    pageCount: number;
}
