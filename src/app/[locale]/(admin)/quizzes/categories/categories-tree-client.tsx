'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
    DndContext,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import {
    CategoryCascadeBlockedError,
    deleteCategory,
    listCategories,
    upsertCategory,
} from '@/lib/quizzes/api';
import type { QuizCategory } from '@/lib/quizzes/types';
import { CategoryRow } from './components/category-row';
import { UpsertCategoryDialog } from './components/upsert-category-dialog';

/**
 * QZ-04 — recursive QuizCategory tree editor.
 *
 * Schema-truth caveats baked in:
 *   - QuizCategory has NO `name` column → display name lives in
 *     QuizCategoryTranslation.title per locale (RU primary, KZ subtitle).
 *   - QuizCategory has NO `order` column → SIBLING ORDER IS NOT PERSISTED across
 *     reloads. dnd-kit drops are persisted ONLY when they change parent_id;
 *     same-parent reorders are visual-only and lost on next refetch. The plan
 *     body (D-15) acknowledges this; revisit when an `order` column is added.
 *   - Server enforces cycle detection on PATCH; client also guards via a
 *     depth-50 recursion limit when building the tree (T-06-30 belt-and-braces).
 *
 * Force-delete safety contract (rendered to user):
 *   When a category has dependents, server returns 409 with
 *   { quiz_count, child_count }. UI shows the cascade-warning Dialog with the
 *   exact counts + a checkbox forcing the user to acknowledge that:
 *     - dependent quizzes will be re-pointed to "no category" (NOT deleted)
 *     - direct child categories will be re-pointed to this row's PARENT
 *   Only after the checkbox is ticked does the Delete button enable, sending
 *   ?force=true.
 */
export interface TreeNode extends QuizCategory {
    children: TreeNode[];
}

const CLIENT_DEPTH_GUARD = 50;

function buildTree(rows: QuizCategory[]): TreeNode[] {
    const nodes = new Map<number, TreeNode>();
    for (const r of rows) {
        nodes.set(r.id, { ...r, children: [] });
    }
    const roots: TreeNode[] = [];
    for (const node of nodes.values()) {
        if (node.parent_id != null && nodes.has(node.parent_id)) {
            nodes.get(node.parent_id)!.children.push(node);
        } else {
            roots.push(node);
        }
    }
    // Iterative depth-prune (T-06-30 belt-and-braces).
    function prune(level: TreeNode[], depth: number): void {
        if (depth >= CLIENT_DEPTH_GUARD) {
            for (const n of level) n.children = [];
            return;
        }
        for (const n of level) prune(n.children, depth + 1);
    }
    prune(roots, 0);
    // Sort siblings by id ASC (no order column in schema).
    function sortSiblings(level: TreeNode[]): void {
        level.sort((a, b) => a.id - b.id);
        for (const n of level) sortSiblings(n.children);
    }
    sortSiblings(roots);
    return roots;
}

function flattenIds(roots: TreeNode[]): string[] {
    const out: string[] = [];
    function walk(level: TreeNode[]): void {
        for (const n of level) {
            out.push(`category-${n.id}`);
            if (n.children.length > 0) walk(n.children);
        }
    }
    walk(roots);
    return out;
}

export function CategoriesTreeClient() {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['admin.quiz-categories.list'],
        queryFn: listCategories,
    });

    const tree = useMemo(() => buildTree(rows), [rows]);

    // ── Dialog state ────────────────────────────────────────────────────────
    const [upsertOpen, setUpsertOpen] = useState(false);
    const [upsertParentId, setUpsertParentId] = useState<number | null>(null);
    const [upsertInitial, setUpsertInitial] = useState<
        | {
              id: number;
              parent_id: number | null;
              ru_title: string;
              kz_title: string;
          }
        | undefined
    >(undefined);

    const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null);
    const [deleteCounts, setDeleteCounts] = useState<{ quiz_count: number; child_count: number } | null>(
        null,
    );
    const [deleteAck, setDeleteAck] = useState(false);

    // ── Move-by-drag mutation (parent_id PATCH only — no sibling-order persist) ──
    const moveMutation = useMutation({
        mutationFn: (vars: { id: number; new_parent_id: number | null }) =>
            upsertCategory({ id: vars.id, parent_id: vars.new_parent_id, translations: [] }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.quiz-categories.list'] });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('categories.generic_error');
            toast.error(msg);
            // Force re-fetch — the server is the source of truth on rejection.
            qc.invalidateQueries({ queryKey: ['admin.quiz-categories.list'] });
        },
    });

    // ── Delete mutation: tries without force first, on 409 surfaces counts ──
    const tryDeleteMutation = useMutation({
        mutationFn: (vars: { id: number; force: boolean }) =>
            deleteCategory(vars.id, vars.force),
        onSuccess: (result) => {
            const summary = t('categories.deleted_with_repoint', {
                quizzes: result.quizzes_repointed,
                children: result.children_repointed,
            });
            toast.success(summary);
            qc.invalidateQueries({ queryKey: ['admin.quiz-categories.list'] });
            setDeleteTarget(null);
            setDeleteCounts(null);
            setDeleteAck(false);
        },
        onError: (err: unknown) => {
            if (err instanceof CategoryCascadeBlockedError) {
                setDeleteCounts({ quiz_count: err.quiz_count, child_count: err.child_count });
                return;
            }
            const msg = err instanceof Error ? err.message : t('categories.generic_error');
            toast.error(msg);
        },
    });

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const activeData = active.data.current as { type?: string; categoryId?: number; parentId?: number | null } | undefined;
        const overData = over.data.current as { type?: string; categoryId?: number; parentId?: number | null } | undefined;
        if (activeData?.type !== 'category') return;
        const movingId = activeData.categoryId!;
        const movingCurrentParent = activeData.parentId ?? null;

        // Determine the target parent_id from the drop target.
        // Drop onto another category row → make it the new parent (nested).
        // (Sibling reorder via drop on same level is NOT persisted — schema lacks `order`.)
        let newParentId: number | null = null;
        if (overData?.type === 'category' && typeof overData.categoryId === 'number') {
            newParentId = overData.categoryId;
        } else {
            return;
        }

        // No-op if dropping into current parent (avoid pointless server hits).
        if (newParentId === movingCurrentParent) return;
        // No-op if dropping onto self.
        if (newParentId === movingId) {
            toast.error(t('categories.cycle_detected'));
            return;
        }

        moveMutation.mutate({ id: movingId, new_parent_id: newParentId });
    };

    const openCreateRoot = () => {
        setUpsertInitial(undefined);
        setUpsertParentId(null);
        setUpsertOpen(true);
    };
    const openCreateChild = (parentId: number) => {
        setUpsertInitial(undefined);
        setUpsertParentId(parentId);
        setUpsertOpen(true);
    };
    const openEdit = (node: TreeNode) => {
        setUpsertInitial({
            id: node.id,
            parent_id: node.parent_id,
            ru_title: node.translations.find((tr) => tr.locale === 'ru')?.title ?? '',
            kz_title: node.translations.find((tr) => tr.locale === 'kz')?.title ?? '',
        });
        setUpsertParentId(node.parent_id);
        setUpsertOpen(true);
    };

    const openDelete = (node: TreeNode) => {
        setDeleteTarget(node);
        setDeleteAck(false);
        setDeleteCounts(null);
        // Optimistically use the node's known counts as initial guess; server's 409
        // will overwrite with authoritative numbers if cascade is blocked.
        const provisional = {
            quiz_count: node.quiz_count ?? 0,
            child_count: node.child_count ?? 0,
        };
        if (provisional.quiz_count === 0 && provisional.child_count === 0) {
            // No dependents — delete straight away (server will still no-op-cascade).
            tryDeleteMutation.mutate({ id: node.id, force: false });
        } else {
            // Pre-populate counts (server will confirm via 409 if force isn't supplied).
            setDeleteCounts(provisional);
        }
    };

    const confirmForceDelete = () => {
        if (!deleteTarget) return;
        tryDeleteMutation.mutate({ id: deleteTarget.id, force: true });
    };

    const cancelDelete = () => {
        setDeleteTarget(null);
        setDeleteCounts(null);
        setDeleteAck(false);
    };

    const flatIds = useMemo(() => flattenIds(tree), [tree]);

    const renderChildren = (children: TreeNode[], depth: number): React.ReactNode =>
        children.map((child) => (
            <CategoryRow
                key={child.id}
                node={child}
                depth={depth}
                onAddChild={openCreateChild}
                onEdit={openEdit}
                onDelete={openDelete}
                renderChildren={renderChildren}
            />
        ));

    return (
        <div className='space-y-4 p-4'>
            <div className='flex items-center justify-between'>
                <div>
                    <h1 className='text-2xl font-bold'>{t('categories.page_title')}</h1>
                    <p className='text-muted-foreground text-sm'>{t('categories.page_subtitle')}</p>
                </div>
                <Button type='button' onClick={openCreateRoot}>
                    <Plus className='mr-2 h-4 w-4' />
                    {t('categories.add_root')}
                </Button>
            </div>

            {isLoading ? (
                <div className='text-muted-foreground p-6'>{t('loading')}</div>
            ) : tree.length === 0 ? (
                <div className='text-muted-foreground rounded border border-dashed p-6 text-center'>
                    {t('categories.empty')}
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
                        <div className='space-y-2'>
                            {tree.map((node) => (
                                <CategoryRow
                                    key={node.id}
                                    node={node}
                                    depth={0}
                                    onAddChild={openCreateChild}
                                    onEdit={openEdit}
                                    onDelete={openDelete}
                                    renderChildren={renderChildren}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            <UpsertCategoryDialog
                open={upsertOpen}
                onOpenChange={setUpsertOpen}
                initial={upsertInitial}
                parentIdForCreate={upsertParentId}
            />

            {/* Cascade-warning dialog — shows real quiz_count + child_count from
                either the cached node or a 409 server response, plus an explicit
                acknowledgement checkbox before the Delete button enables. */}
            <Dialog
                open={deleteTarget != null && deleteCounts != null}
                onOpenChange={(open) => {
                    if (!open) cancelDelete();
                }}
            >
                <DialogContent className='sm:max-w-lg'>
                    <DialogHeader>
                        <DialogTitle>{t('categories.cascade_blocked_title')}</DialogTitle>
                        <DialogDescription>
                            {t('categories.cascade_blocked_description')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className='space-y-3 text-sm'>
                        <div className='flex justify-between'>
                            <span>{t('categories.cascade_quiz_count')}</span>
                            <span className='font-mono'>{deleteCounts?.quiz_count ?? 0}</span>
                        </div>
                        <div className='flex justify-between'>
                            <span>{t('categories.cascade_child_count')}</span>
                            <span className='font-mono'>{deleteCounts?.child_count ?? 0}</span>
                        </div>
                        <label className='flex items-start gap-2 rounded border p-2'>
                            <Checkbox
                                checked={deleteAck}
                                onCheckedChange={(v) => setDeleteAck(!!v)}
                                className='mt-0.5'
                            />
                            <span className='text-muted-foreground text-xs leading-snug'>
                                {t('categories.cascade_force_warning')}
                            </span>
                        </label>
                    </div>
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={cancelDelete}
                            disabled={tryDeleteMutation.isPending}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            disabled={!deleteAck || tryDeleteMutation.isPending}
                            onClick={confirmForceDelete}
                        >
                            {tryDeleteMutation.isPending
                                ? t('loading')
                                : t('categories.confirm_force_delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
