'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDroppable } from '@dnd-kit/core';
import { ChevronRight, Folder, FolderOpen, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FolderNode } from '@/lib/folders/use-folder-tree';

export interface FolderTreeProps {
    /** Tree built from `buildFolderTree`. */
    nodes: FolderNode[];
    /** Currently selected folder id (null = root). */
    selectedId: number | null;
    /** Triggered when the user clicks a node label. */
    onSelect: (id: number | null) => void;
    /** Whether a card is currently being dragged — toggles drop-target visuals. */
    dropEnabled?: boolean;
    className?: string;
}

/**
 * Recursive collapsible folder tree with a synthetic root row at the top.
 * Each folder is a @dnd-kit droppable target so files can be dropped here
 * to move them. The root row's droppable id is the literal string `'root'`.
 */
export function FolderTree({ nodes, selectedId, onSelect, dropEnabled, className }: FolderTreeProps) {
    const t = useTranslations('files.folders');
    return (
        <div className={cn('flex flex-col gap-0.5 text-sm', className)}>
            <FolderRow
                droppableId='folder-root'
                folderId={null}
                label={t('root')}
                depth={0}
                hasChildren={nodes.length > 0}
                expanded
                selected={selectedId === null}
                dropEnabled={dropEnabled}
                onSelect={onSelect}
                onToggleExpand={() => undefined}
                rootIcon
            />
            {nodes.map((node) => (
                <FolderBranch
                    key={node.id}
                    node={node}
                    depth={1}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    dropEnabled={dropEnabled}
                />
            ))}
        </div>
    );
}

function FolderBranch({
    node,
    depth,
    selectedId,
    onSelect,
    dropEnabled,
}: {
    node: FolderNode;
    depth: number;
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    dropEnabled?: boolean;
}) {
    const [expanded, setExpanded] = useState(depth <= 1);
    const hasChildren = node.children.length > 0;
    return (
        <>
            <FolderRow
                droppableId={`folder-${node.id}`}
                folderId={node.id}
                label={node.name}
                depth={depth}
                hasChildren={hasChildren}
                expanded={expanded}
                selected={selectedId === node.id}
                dropEnabled={dropEnabled}
                onSelect={onSelect}
                onToggleExpand={() => setExpanded((v) => !v)}
            />
            {expanded
                ? node.children.map((child) => (
                      <FolderBranch
                          key={child.id}
                          node={child}
                          depth={depth + 1}
                          selectedId={selectedId}
                          onSelect={onSelect}
                          dropEnabled={dropEnabled}
                      />
                  ))
                : null}
        </>
    );
}

function FolderRow({
    droppableId,
    folderId,
    label,
    depth,
    hasChildren,
    expanded,
    selected,
    dropEnabled,
    onSelect,
    onToggleExpand,
    rootIcon,
}: {
    droppableId: string;
    folderId: number | null;
    label: string;
    depth: number;
    hasChildren: boolean;
    expanded: boolean;
    selected: boolean;
    dropEnabled?: boolean;
    onSelect: (id: number | null) => void;
    onToggleExpand: () => void;
    rootIcon?: boolean;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: droppableId,
        data: { type: 'folder', folderId },
        disabled: !dropEnabled,
    });
    return (
        <div
            ref={setNodeRef}
            className={cn(
                'group flex items-center gap-1 rounded px-1 py-1.5 transition-colors',
                selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                isOver && dropEnabled ? 'ring-primary bg-primary/10 ring-2' : '',
            )}
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
            <button
                type='button'
                onClick={onToggleExpand}
                aria-label={expanded ? 'collapse' : 'expand'}
                className={cn(
                    'flex h-5 w-5 items-center justify-center rounded',
                    hasChildren ? 'hover:bg-muted-foreground/10' : 'pointer-events-none opacity-0',
                )}
            >
                <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded ? 'rotate-90' : '')} />
            </button>
            <button
                type='button'
                onClick={() => onSelect(folderId)}
                className='flex flex-1 items-center gap-2 overflow-hidden text-left'
            >
                {rootIcon ? (
                    <Home className='h-4 w-4 shrink-0' />
                ) : expanded && hasChildren ? (
                    <FolderOpen className='h-4 w-4 shrink-0' />
                ) : (
                    <Folder className='h-4 w-4 shrink-0' />
                )}
                <span className='truncate'>{label}</span>
            </button>
        </div>
    );
}
