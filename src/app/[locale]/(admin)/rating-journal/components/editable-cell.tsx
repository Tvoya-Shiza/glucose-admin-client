'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
 * Inline-editable number cell (0..max). Every value CHANGE is confirmed before it
 * is saved (item 6 — «доп подтверждение на всякий случай»): editing stages the
 * value, a dialog shows было→стало, and only on confirm is the optimistic update +
 * updateCell fired (snapshot-in-ref rollback on error). Cancel reverts the input.
 * Cells carrying is_manual_override render a subtle ring + dot marker.
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
    const [pending, setPending] = useState<number | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const snapshotRef = useRef<JournalGrid | undefined>(undefined);
    // True while the user is actively editing this input (focused / confirm pending).
    // Guards the re-sync effect so a concurrent grid refetch can't clobber an
    // in-progress value — before blur (dialog not yet open) as well as during it.
    const editingRef = useRef(false);

    // Re-sync local when the authoritative server value changes (e.g. after sync /
    // invalidate) — but never while the user is mid-edit.
    useEffect(() => {
        if (!confirmOpen && !editingRef.current) setLocal(serverValue != null ? String(serverValue) : '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverValue]);

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

    function revertLocal(): void {
        setLocal(serverValue != null ? String(serverValue) : '');
    }

    /** Validate the staged raw value; open the confirm dialog when it changes. */
    function requestCommit(raw: string): void {
        const trimmed = raw.trim();
        const parsed = trimmed === '' ? null : Number(trimmed);
        if (parsed != null && (Number.isNaN(parsed) || parsed < 0 || parsed > column.max_score)) {
            revertLocal(); // out of range — no request, no dialog
            editingRef.current = false;
            return;
        }
        if (parsed === serverValue) {
            editingRef.current = false;
            return; // unchanged
        }
        setPending(parsed);
        setConfirmOpen(true); // editing stays "active" until confirm/cancel
    }

    function confirmCommit(): void {
        const value = pending;
        editingRef.current = false;
        setConfirmOpen(false);
        applyOptimistic(value);
        updateCell({ column_id: column.id, student_id: studentId, value })
            .then(() => {
                snapshotRef.current = undefined;
                qc.invalidateQueries({ queryKey: gridQueryKey });
            })
            .catch((err: unknown) => {
                rollback();
                revertLocal();
                toast.error(err instanceof Error && err.message ? err.message : t('generic_error'));
            });
    }

    function cancelCommit(): void {
        editingRef.current = false;
        setConfirmOpen(false);
        revertLocal();
    }

    const isOverride = cell?.is_manual_override ?? false;
    const oldLabel = serverValue != null ? String(serverValue) : '—';
    const newLabel = pending != null ? String(pending) : '—';
    const isOverwrite = serverValue != null;

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
                    onFocus={() => {
                        editingRef.current = true;
                    }}
                    onChange={(e) => setLocal(e.target.value)}
                    onBlur={(e) => requestCommit(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
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

            <Dialog
                open={confirmOpen}
                onOpenChange={(o) => {
                    if (!o) cancelCommit();
                }}
            >
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>{t('edit_confirm_title')}</DialogTitle>
                        <DialogDescription>
                            {t('edit_confirm_description', { column: column.title, old: oldLabel, new: newLabel })}
                            {isOverwrite ? ` ${t('edit_confirm_overwrite')}` : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type='button' variant='outline' onClick={cancelCommit}>
                            {t('cancel')}
                        </Button>
                        <Button type='button' onClick={confirmCommit}>
                            {t('confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TableCell>
    );
}
