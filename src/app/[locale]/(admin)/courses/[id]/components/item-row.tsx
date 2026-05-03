'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, BookOpen, Image as ImageIcon, Video as VideoIcon, ClipboardList, FilePen, Pencil, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteItem } from '@/lib/courses/api';
import type { ChapterItem } from '@/lib/courses/types';
import { UpsertItemDialog } from './upsert-item-dialog';

/**
 * ItemRow — draggable WebinarChapterItem inside a chapter (CRS-03).
 *
 * Drag handle uses dnd-kit's `attributes`+`listeners` from useSortable. Body of
 * the row (title, edit, delete) is NOT inside the draggable region so click
 * events on action buttons don't initiate a drag.
 *
 * Type icon resolution:
 *   - type='file' + file.file_type startsWith 'image/' → ImageIcon
 *   - type='file' + file.file_type startsWith 'video/' → VideoIcon
 *   - type='file' + (text/html or unset) → BookOpen (rich-text)
 *   - type='quiz' → ClipboardList
 *   - type='assignment' → FilePen
 */
export interface ItemRowProps {
    courseId: number;
    chapterId: number;
    item: ChapterItem;
}

export function ItemRow({ courseId, chapterId, item }: ItemRowProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `item-${item.id}`,
        data: { type: 'item', itemId: item.id, chapterId },
    });

    const [editOpen, setEditOpen] = useState(false);

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const deleteMutation = useMutation({
        mutationFn: () => deleteItem(courseId, item.id),
        onSuccess: () => {
            toast.success(t('saved'));
            qc.invalidateQueries({ queryKey: ['admin.courses.detail', courseId] });
        },
        onError: (err: Error) => {
            toast.error(err.message || t('save_failed'));
        },
    });

    const handleDelete = () => {
        if (typeof window !== 'undefined' && !window.confirm(t('delete_item_confirm'))) {
            return;
        }
        deleteMutation.mutate();
    };

    const Icon = (() => {
        if (item.type === 'quiz') return ClipboardList;
        if (item.type === 'assignment') return FilePen;
        const mime = item.file?.file_type ?? '';
        if (mime.startsWith('image/')) return ImageIcon;
        if (mime.startsWith('video/')) return VideoIcon;
        return BookOpen;
    })();

    const label = (() => {
        const ru = item.translations?.find((tr) => tr.locale === 'ru')?.title;
        if (ru && ru.length > 0) return ru;
        if (item.type === 'quiz' && item.quiz?.slug) return item.quiz.slug;
        if (item.type === 'assignment') return `#${item.item_id}`;
        if (item.file?.file) return item.file.file.split('/').pop() ?? `#${item.id}`;
        return `#${item.id}`;
    })();

    return (
        <div
            ref={setNodeRef}
            style={style}
            className='bg-background flex items-center gap-2 rounded border px-2 py-1.5'
        >
            <button
                type='button'
                className='text-muted-foreground hover:text-foreground cursor-grab touch-none px-1 py-1.5'
                aria-label={t('drag_handle_aria')}
                {...attributes}
                {...listeners}
            >
                <GripVertical className='h-4 w-4' />
            </button>
            <Icon className='text-muted-foreground h-4 w-4 shrink-0' />
            <div className='min-w-0 flex-1 truncate text-sm'>{label}</div>
            <Button type='button' variant='ghost' size='sm' onClick={() => setEditOpen(true)} aria-label={t('edit')}>
                <Pencil className='h-4 w-4' />
            </Button>
            <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                aria-label={t('delete_item')}
            >
                <Trash className='h-4 w-4' />
            </Button>
            {editOpen ? (
                <UpsertItemDialog
                    courseId={courseId}
                    chapterId={chapterId}
                    item={item}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />
            ) : null}
        </div>
    );
}
