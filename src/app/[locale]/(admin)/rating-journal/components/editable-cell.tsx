'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { TableCell } from '@/components/ui/table';
import { updateCell } from '@/lib/rating-journal/api';
import type { JournalCell, JournalColumn, JournalGrid } from '@/lib/rating-journal/types';

export interface EditableCellProps {
    gridQueryKey: readonly unknown[];
    column: JournalColumn;
    studentId: number;
    cell: JournalCell | undefined;
    canEdit: boolean;
    canViewHistory: boolean;
    onOpenHistory: (columnId: string, studentId: number) => void;
}

/**
 * Inline-editable number cell (0..max_score). Debounced autosave (300ms) with an
 * optimistic queryClient.setQueryData update and snapshot-in-ref rollback on
 * error. Cells carrying is_manual_override render a subtle ring + dot marker.
 * Auto columns stay editable (the edit becomes a manual override server-side).
 */
export function EditableCell({
    gridQueryKey,
    column,
    studentId,
    cell,
    canEdit,
    canViewHistory,
    onOpenHistory,
}: EditableCellProps) {
    const t = useTranslations('admin.ratingJournal');
    const qc = useQueryClient();

    const serverValue = cell?.value ?? null;
    const [local, setLocal] = useState<string>(serverValue != null ? String(serverValue) : '');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const snapshotRef = useRef<JournalGrid | undefined>(undefined);

    // Re-sync local when the authoritative server value changes (e.g. after sync /
    // invalidate) — but not while the user is mid-edit (debounce pending).
    useEffect(() => {
        if (debounceRef.current == null) {
            setLocal(serverValue != null ? String(serverValue) : '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverValue]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    /** Recompute a row's total from its cells against the current column max set. */
    function applyOptimistic(nextValue: number | null): void {
        const current = qc.getQueryData<JournalGrid>(gridQueryKey);
        if (!current) return;
        snapshotRef.current = current;

        const next: JournalGrid = {
            ...current,
            rows: current.rows.map((row) => {
                if (row.student_id !== studentId) return row;
                const nextCells: Record<string, JournalCell> = {
                    ...row.cells,
                    [column.id]: { column_id: column.id, value: nextValue, is_manual_override: true },
                };
                const total = Object.values(nextCells).reduce((sum, c) => sum + (c.value ?? 0), 0);
                return { ...row, cells: nextCells, total };
            }),
        };
        qc.setQueryData(gridQueryKey, next);
    }

    function rollback(): void {
        if (snapshotRef.current) {
            qc.setQueryData(gridQueryKey, snapshotRef.current);
            snapshotRef.current = undefined;
        }
    }

    function commit(raw: string): void {
        const trimmed = raw.trim();
        const parsed = trimmed === '' ? null : Number(trimmed);
        if (parsed != null && (Number.isNaN(parsed) || parsed < 0 || parsed > column.max_score)) {
            // Out of range — revert the input to the last server value, no request.
            setLocal(serverValue != null ? String(serverValue) : '');
            return;
        }
        if (parsed === serverValue) return;

        applyOptimistic(parsed);
        updateCell({ column_id: column.id, student_id: studentId, value: parsed })
            .then(() => {
                snapshotRef.current = undefined;
                qc.invalidateQueries({ queryKey: gridQueryKey });
            })
            .catch((err: unknown) => {
                rollback();
                setLocal(serverValue != null ? String(serverValue) : '');
                toast.error(err instanceof Error && err.message ? err.message : t('generic_error'));
            });
    }

    function scheduleCommit(raw: string): void {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            commit(raw);
        }, 300);
    }

    const isOverride = cell?.is_manual_override ?? false;

    return (
        <TableCell className='p-1 text-center'>
            <div className='relative inline-flex items-center'>
                <input
                    type='number'
                    inputMode='numeric'
                    min={0}
                    max={column.max_score}
                    disabled={!canEdit}
                    value={local}
                    onChange={(e) => {
                        setLocal(e.target.value);
                        scheduleCommit(e.target.value);
                    }}
                    onBlur={(e) => {
                        if (debounceRef.current) {
                            clearTimeout(debounceRef.current);
                            debounceRef.current = null;
                        }
                        commit(e.target.value);
                    }}
                    onDoubleClick={() => {
                        if (canViewHistory) onOpenHistory(column.id, studentId);
                    }}
                    title={isOverride ? t('cell_override_hint') : undefined}
                    className={`h-8 w-16 rounded border bg-background text-center text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                        isOverride ? 'ring-1 ring-amber-400' : ''
                    }`}
                />
                {isOverride ? (
                    <span
                        aria-hidden
                        className='pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500'
                        title={t('cell_override_hint')}
                    />
                ) : null}
            </div>
        </TableCell>
    );
}
