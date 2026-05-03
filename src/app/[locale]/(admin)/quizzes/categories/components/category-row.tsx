'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Pencil, Plus, Trash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TreeNode } from '../categories-tree-client';

/**
 * QZ-04 — single QuizCategory row in the recursive tree editor.
 *
 * Renders title (RU primary, KZ small/muted), quiz_count + child_count badges,
 * a drag handle, and an action menu (Add child / Edit / Delete). Children are
 * rendered recursively via `renderChild` which the parent passes down so
 * dnd-kit's outer `<DndContext>` can collect ALL row ids in a single sortable
 * context (flat-id strategy explained in categories-tree-client.tsx).
 *
 * Sortable id pattern: `category-${node.id}`.
 * Sortable data: `{ type: 'category', categoryId, parentId }` — the drag-end
 * handler in the parent uses these to compute the new parent_id.
 */
export interface CategoryRowProps {
    node: TreeNode;
    depth: number;
    onAddChild: (parentId: number) => void;
    onEdit: (node: TreeNode) => void;
    onDelete: (node: TreeNode) => void;
    renderChildren: (children: TreeNode[], depth: number) => React.ReactNode;
}

export function CategoryRow({
    node,
    depth,
    onAddChild,
    onEdit,
    onDelete,
    renderChildren,
}: CategoryRowProps) {
    const t = useTranslations('admin.quizzes');
    const [expanded, setExpanded] = useState(true);

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `category-${node.id}`,
        data: { type: 'category', categoryId: node.id, parentId: node.parent_id },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const ruTitle = node.translations?.find((tr) => tr.locale === 'ru')?.title ?? '';
    const kzTitle = node.translations?.find((tr) => tr.locale === 'kz')?.title ?? '';
    const headerLabel = ruTitle.trim().length > 0 ? ruTitle : `#${node.id}`;
    const hasChildren = node.children.length > 0;

    // Indent by depth (Tailwind: padding-left = depth × 4 = depth-based ml).
    const indent: React.CSSProperties = { marginLeft: `${Math.min(depth, 50) * 16}px` };

    return (
        <div ref={setNodeRef} style={style}>
            <div className='bg-card flex items-center gap-2 rounded-lg border p-2' style={indent}>
                <button
                    type='button'
                    className='text-muted-foreground hover:text-foreground cursor-grab touch-none p-1.5'
                    aria-label={t('categories.drag_handle')}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className='h-4 w-4' />
                </button>
                {hasChildren ? (
                    <button
                        type='button'
                        className='text-muted-foreground hover:text-foreground p-1'
                        onClick={() => setExpanded((v) => !v)}
                        aria-label={expanded ? t('categories.collapse') : t('categories.expand')}
                    >
                        {expanded ? (
                            <ChevronDown className='h-4 w-4' />
                        ) : (
                            <ChevronRight className='h-4 w-4' />
                        )}
                    </button>
                ) : (
                    <span className='inline-block h-4 w-4' />
                )}
                <div className='min-w-0 flex-1'>
                    <div className='truncate text-sm font-medium'>{headerLabel}</div>
                    {kzTitle.length > 0 && (
                        <div className='text-muted-foreground truncate text-xs'>{kzTitle}</div>
                    )}
                </div>
                <Badge variant='secondary' className='shrink-0'>
                    {t('categories.quiz_count_badge', { count: node.quiz_count ?? 0 })}
                </Badge>
                <Badge variant='outline' className='shrink-0'>
                    {t('categories.child_count_badge', { count: node.child_count ?? 0 })}
                </Badge>
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => onAddChild(node.id)}
                    title={t('categories.add_child')}
                    aria-label={t('categories.add_child')}
                >
                    <Plus className='h-4 w-4' />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            aria-label={t('categories.row_actions')}
                        >
                            <MoreHorizontal className='h-4 w-4' />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                        <DropdownMenuItem onClick={() => onEdit(node)}>
                            <Pencil className='mr-2 h-4 w-4' />
                            {t('categories.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAddChild(node.id)}>
                            <Plus className='mr-2 h-4 w-4' />
                            {t('categories.add_child')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onDelete(node)}
                            className='text-destructive'
                        >
                            <Trash className='mr-2 h-4 w-4' />
                            {t('categories.delete')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {hasChildren && expanded && (
                <div className='mt-2 space-y-2'>{renderChildren(node.children, depth + 1)}</div>
            )}
        </div>
    );
}
