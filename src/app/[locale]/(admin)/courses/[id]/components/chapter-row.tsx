'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Pencil, Trash, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deleteChapter } from '@/lib/courses/api';
import type { Chapter } from '@/lib/courses/types';
import { ItemRow } from './item-row';
import { UpsertChapterDialog } from './upsert-chapter-dialog';
import { UpsertItemDialog } from './upsert-item-dialog';

/**
 * ChapterRow — draggable WebinarChapter (CRS-03). Hosts a nested SortableContext
 * for items so drag-drop works WITHIN-chapter and ACROSS chapters (the parent
 * DndContext bridges the two via collision detection).
 *
 * Visual: title (RU translation, fallback to `#<id>`), status badge, drag handle,
 * Add Item / Edit Chapter / Delete Chapter buttons. Items list collapsible via
 * a local state toggle (defaults open).
 */
export interface ChapterRowProps {
    courseId: number;
    chapter: Chapter;
}

export function ChapterRow({ courseId, chapter }: ChapterRowProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `chapter-${chapter.id}`,
        data: { type: 'chapter', chapterId: chapter.id },
    });

    const [expanded, setExpanded] = useState(true);
    const [editOpen, setEditOpen] = useState(false);
    const [addItemOpen, setAddItemOpen] = useState(false);

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const deleteMutation = useMutation({
        mutationFn: () => deleteChapter(courseId, chapter.id),
        onSuccess: () => {
            toast.success(t('saved'));
            qc.invalidateQueries({ queryKey: ['admin.courses.detail', courseId] });
        },
        onError: (err: Error) => {
            toast.error(err.message || t('save_failed'));
        },
    });

    const handleDelete = () => {
        if (typeof window !== 'undefined' && !window.confirm(t('delete_chapter_confirm'))) {
            return;
        }
        deleteMutation.mutate();
    };

    const ruTitle = chapter.translations?.find((tr) => tr.locale === 'kz')?.title;
    const headerLabel = ruTitle && ruTitle.length > 0 ? ruTitle : `#${chapter.id}`;

    const itemSortableIds = chapter.items.map((i) => `item-${i.id}`);

    return (
        <div ref={setNodeRef} style={style} className='bg-card rounded-lg border'>
            <div className='flex items-center gap-2 border-b p-2'>
                <button
                    type='button'
                    className='text-muted-foreground hover:text-foreground cursor-grab touch-none p-1.5'
                    aria-label={t('drag_handle_aria')}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className='h-4 w-4' />
                </button>
                <button
                    type='button'
                    className='text-muted-foreground hover:text-foreground p-1'
                    onClick={() => setExpanded((x) => !x)}
                    aria-label={expanded ? 'collapse' : 'expand'}
                >
                    {expanded ? <ChevronDown className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}
                </button>
                <div className='min-w-0 flex-1 truncate font-medium'>{headerLabel}</div>
                <Badge variant={chapter.status === 'active' ? 'default' : 'secondary'}>
                    {chapter.status === 'active' ? t('chapter_status_active') : t('chapter_status_inactive')}
                </Badge>
                <Button type='button' variant='ghost' size='sm' onClick={() => setAddItemOpen(true)} aria-label={t('add_item')}>
                    <Plus className='h-4 w-4' />
                </Button>
                <Button type='button' variant='ghost' size='sm' onClick={() => setEditOpen(true)} aria-label={t('edit')}>
                    <Pencil className='h-4 w-4' />
                </Button>
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    aria-label={t('delete_chapter')}
                >
                    <Trash className='h-4 w-4' />
                </Button>
            </div>

            {expanded ? (
                <div className='space-y-2 p-2'>
                    <SortableContext items={itemSortableIds} strategy={verticalListSortingStrategy}>
                        {chapter.items.length === 0 ? (
                            <div className='text-muted-foreground rounded border border-dashed p-3 text-center text-sm'>
                                {t('no_items_in_chapter')}
                            </div>
                        ) : (
                            chapter.items.map((it) => (
                                <ItemRow key={it.id} courseId={courseId} chapterId={chapter.id} item={it} />
                            ))
                        )}
                    </SortableContext>
                </div>
            ) : null}

            {editOpen ? (
                <UpsertChapterDialog courseId={courseId} chapter={chapter} open={editOpen} onOpenChange={setEditOpen} />
            ) : null}
            {addItemOpen ? (
                <UpsertItemDialog
                    courseId={courseId}
                    chapterId={chapter.id}
                    open={addItemOpen}
                    onOpenChange={setAddItemOpen}
                />
            ) : null}
        </div>
    );
}
