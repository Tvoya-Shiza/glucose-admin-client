'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, GripVertical, MoreHorizontal, Pencil, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableHead } from '@/components/ui/table';
import type { JournalColumn } from '@/lib/rating-journal/types';

export interface ColumnHeaderCellProps {
    column: JournalColumn;
    canManage: boolean;
    onEdit: (column: JournalColumn) => void;
    onToggleHidden: (column: JournalColumn) => void;
    onDelete: (column: JournalColumn) => void;
}

/**
 * Sortable header cell for one grading column. Drag handle reorders columns via
 * the parent DndContext (horizontal SortableContext). The menu offers edit (manual
 * only), hide/show, and delete (manual only). Auto columns are read-only otherwise.
 */
export function ColumnHeaderCell({ column, canManage, onEdit, onToggleHidden, onDelete }: ColumnHeaderCellProps) {
    const t = useTranslations('admin.ratingJournal');
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `col-${column.id}`,
        data: { type: 'column', columnId: column.id },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <TableHead
            ref={setNodeRef}
            style={style}
            className={`min-w-28 text-center align-top ${column.is_hidden ? 'opacity-50' : ''}`}
        >
            <div className='flex items-start justify-between gap-1'>
                {canManage ? (
                    <button
                        type='button'
                        className='text-muted-foreground hover:text-foreground mt-0.5 cursor-grab touch-none'
                        aria-label={t('drag_handle_aria')}
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className='h-3.5 w-3.5' />
                    </button>
                ) : null}
                <div className='min-w-0 flex-1'>
                    <div className='truncate font-medium' title={column.title}>
                        {column.title}
                    </div>
                    <div className='text-muted-foreground text-[10px] font-normal'>
                        {column.max_score}
                        {column.is_auto ? ` · ${t('column_auto_badge')}` : ''}
                        {column.is_hidden ? ` · ${t('column_hidden_badge')}` : ''}
                    </div>
                </div>
                {canManage ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon' className='h-6 w-6' aria-label={t('actions')}>
                                <MoreHorizontal className='h-3.5 w-3.5' />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                            {column.is_custom ? (
                                <DropdownMenuItem onSelect={() => onEdit(column)}>
                                    <Pencil className='mr-2 h-4 w-4' />
                                    {t('edit_column')}
                                </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onSelect={() => onToggleHidden(column)}>
                                {column.is_hidden ? <Eye className='mr-2 h-4 w-4' /> : <EyeOff className='mr-2 h-4 w-4' />}
                                {column.is_hidden ? t('show_column') : t('hide_column')}
                            </DropdownMenuItem>
                            {column.is_custom ? (
                                <DropdownMenuItem className='text-destructive' onSelect={() => onDelete(column)}>
                                    <Trash className='mr-2 h-4 w-4' />
                                    {t('delete_column')}
                                </DropdownMenuItem>
                            ) : null}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
            </div>
        </TableHead>
    );
}
