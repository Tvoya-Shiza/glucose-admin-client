'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteColumn, reorderColumns, updateColumn } from '@/lib/rating-journal/api';
import type { JournalColumn, JournalGrid as JournalGridData } from '@/lib/rating-journal/types';
import { ColumnHeaderCell } from './column-header-cell';
import { EditableCell } from './editable-cell';

export interface JournalGridProps {
    grid: JournalGridData;
    gridQueryKey: readonly unknown[];
    canEdit: boolean;
    canManage: boolean;
    canViewHistory: boolean;
    onEditColumn: (column: JournalColumn) => void;
    onOpenHistory: (columnId: string, studentId: number) => void;
}

/**
 * Editable sticky gradebook grid.
 *
 * Layout: first column (ФИО) sticky-left; header row sticky-top. Body cells are
 * inline-editable number inputs (EditableCell). The last column shows row.total,
 * its header shows max_total.
 *
 * Column reorder: dnd-kit horizontal SortableContext over the header cells.
 * Optimistic reorder against the grid cache with snapshot-in-ref rollback, then
 * PATCH rating-journal/columns/reorder.
 */
export function JournalGrid({
    grid,
    gridQueryKey,
    canEdit,
    canManage,
    canViewHistory,
    onEditColumn,
    onOpenHistory,
}: JournalGridProps) {
    const t = useTranslations('admin.ratingJournal');
    const qc = useQueryClient();

    // Local column order mirror for optimistic drag — synced from props.
    const [columns, setColumns] = useState<JournalColumn[]>(() => [...grid.columns].sort((a, b) => a.position - b.position));
    const snapshotRef = useRef<JournalGridData | undefined>(undefined);

    useEffect(() => {
        setColumns([...grid.columns].sort((a, b) => a.position - b.position));
    }, [grid.columns]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

    const reorderMutation = useMutation({
        mutationFn: (order: { id: string; position: number }[]) => reorderColumns({ order }),
        onSuccess: () => {
            toast.success(t('reorder_saved'));
            snapshotRef.current = undefined;
            qc.invalidateQueries({ queryKey: gridQueryKey });
        },
        onError: (err: Error) => {
            if (snapshotRef.current) {
                qc.setQueryData(gridQueryKey, snapshotRef.current);
                setColumns([...snapshotRef.current.columns].sort((a, b) => a.position - b.position));
                snapshotRef.current = undefined;
            }
            toast.error(err.message ? `${t('reorder_failed_restoring')}: ${err.message}` : t('reorder_failed_restoring'));
        },
    });

    const toggleHiddenMutation = useMutation({
        mutationFn: (col: JournalColumn) => updateColumn(col.id, { is_hidden: !col.is_hidden }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: gridQueryKey });
        },
        onError: (err: Error) => toast.error(err.message || t('generic_error')),
    });

    const deleteMutation = useMutation({
        mutationFn: (col: JournalColumn) => deleteColumn(col.id),
        onSuccess: () => {
            toast.success(t('column_deleted'));
            qc.invalidateQueries({ queryKey: gridQueryKey });
        },
        onError: (err: Error) => toast.error(err.message || t('generic_error')),
    });

    const handleDelete = (col: JournalColumn) => {
        if (typeof window !== 'undefined' && !window.confirm(t('delete_column_confirm', { title: col.title }))) return;
        deleteMutation.mutate(col);
    };

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const fromIdx = columns.findIndex((c) => `col-${c.id}` === String(active.id));
        const toIdx = columns.findIndex((c) => `col-${c.id}` === String(over.id));
        if (fromIdx === -1 || toIdx === -1) return;

        snapshotRef.current = qc.getQueryData<JournalGridData>(gridQueryKey);

        const reordered = arrayMove(columns, fromIdx, toIdx).map((c, idx) => ({ ...c, position: idx + 1 }));
        setColumns(reordered);

        // Reflect the new positions into the grid cache so the render stays consistent.
        const current = qc.getQueryData<JournalGridData>(gridQueryKey);
        if (current) {
            const posById = new Map(reordered.map((c) => [c.id, c.position]));
            qc.setQueryData<JournalGridData>(gridQueryKey, {
                ...current,
                columns: current.columns.map((c) => ({ ...c, position: posById.get(c.id) ?? c.position })),
            });
        }

        reorderMutation.mutate(reordered.map((c) => ({ id: c.id, position: c.position })));
    };

    const sortableIds = useMemo(() => columns.map((c) => `col-${c.id}`), [columns]);

    const stickyHeadBase = 'sticky top-0 z-10 bg-background';
    const stickyNameHeadClass = 'sticky left-0 top-0 z-30 bg-background min-w-[220px]';
    const stickyNameCellClass = 'sticky left-0 z-20 bg-background min-w-[220px] font-medium';

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className={stickyNameHeadClass}>{t('col_student')}</TableHead>
                        <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
                            {columns.map((col) => (
                                <ColumnHeaderCell
                                    key={col.id}
                                    column={col}
                                    canManage={canManage}
                                    onEdit={onEditColumn}
                                    onToggleHidden={(c) => toggleHiddenMutation.mutate(c)}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </SortableContext>
                        <TableHead className={`${stickyHeadBase} min-w-24 text-center font-semibold`}>
                            <div>{t('col_total')}</div>
                            <div className='text-muted-foreground text-[10px] font-normal'>{grid.max_total}</div>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {grid.rows.map((row) => (
                        <TableRow key={row.student_id}>
                            <TableCell className={stickyNameCellClass}>{row.full_name ?? `#${row.student_id}`}</TableCell>
                            {columns.map((col) => (
                                <EditableCell
                                    key={col.id}
                                    gridQueryKey={gridQueryKey}
                                    column={col}
                                    studentId={row.student_id}
                                    cell={row.cells[col.id]}
                                    canEdit={canEdit}
                                    canViewHistory={canViewHistory}
                                    onOpenHistory={onOpenHistory}
                                />
                            ))}
                            <TableCell className='text-center font-semibold tabular-nums'>{row.total}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </DndContext>
    );
}
