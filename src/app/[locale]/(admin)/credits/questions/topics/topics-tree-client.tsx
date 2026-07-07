'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, FolderTree, MoreHorizontalIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/lib/access/use-permission';
import { CreditApiError, createCreditTopic, deleteCreditTopic, listCreditTopics, updateCreditTopic } from '@/lib/credits/api';
import { buildCreditTopicTree, type CreditTopicNode } from '@/lib/credits/topic-tree';

interface UpsertState {
    open: boolean;
    /** null → create; string → topic id being renamed. */
    id: string | null;
    parentId: string | null;
    name: string;
}

const UPSERT_CLOSED: UpsertState = { open: false, id: null, parentId: null, name: '' };

/**
 * Phase 34 — credit topics tree (cloned/simplified from the quizzes
 * categories tree: no drag-and-drop, single `name`, string ids).
 * Add root/child, rename via dialog, archive/restore, delete (409 → toast
 * explaining children/questions exist). Shows question_count per topic.
 */
export function TopicsTreeClient() {
    const t = useTranslations('admin.credit_questions');
    const locale = useLocale();
    const qc = useQueryClient();
    const canManage = usePermission('credits.topics_manage');

    const [showArchived, setShowArchived] = useState(false);

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['admin.credits.topics', { include_archived: showArchived }],
        queryFn: () => listCreditTopics(showArchived),
        staleTime: 0,
    });

    const tree = useMemo(() => buildCreditTopicTree(rows), [rows]);

    const [upsert, setUpsert] = useState<UpsertState>(UPSERT_CLOSED);
    const [deleteTarget, setDeleteTarget] = useState<CreditTopicNode | null>(null);

    const invalidate = () => qc.invalidateQueries({ queryKey: ['admin.credits.topics'], exact: false });

    const upsertMutation = useMutation({
        mutationFn: (state: UpsertState) =>
            state.id != null
                ? updateCreditTopic(state.id, { name: state.name.trim() })
                : createCreditTopic({ parent_id: state.parentId, name: state.name.trim() }),
        onSuccess: (_res, state) => {
            toast.success(state.id != null ? t('topics.updated_success') : t('topics.created_success'));
            setUpsert(UPSERT_CLOSED);
            invalidate();
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error && err.message ? err.message : t('generic_error'));
        },
    });

    const statusMutation = useMutation({
        mutationFn: (node: CreditTopicNode) => updateCreditTopic(node.id, { status: node.status === 'active' ? 'archived' : 'active' }),
        onSuccess: (_res, node) => {
            toast.success(node.status === 'active' ? t('topics.archived_success') : t('topics.restored_success'));
            invalidate();
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error && err.message ? err.message : t('generic_error'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (node: CreditTopicNode) => deleteCreditTopic(node.id),
        onSuccess: () => {
            toast.success(t('topics.deleted_success'));
            setDeleteTarget(null);
            invalidate();
        },
        onError: (err: unknown) => {
            setDeleteTarget(null);
            if (err instanceof CreditApiError && err.httpStatus === 409) {
                toast.error(t('topics.delete_conflict'));
                return;
            }
            toast.error(err instanceof Error && err.message ? err.message : t('generic_error'));
        },
    });

    const renderNode = (node: CreditTopicNode, depth: number): React.ReactNode => (
        <div key={node.id}>
            <div className='flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2' style={{ marginLeft: depth * 24 }}>
                <div className='flex min-w-0 items-center gap-2'>
                    <span className='truncate text-sm font-medium'>{node.name}</span>
                    <Badge variant='outline'>{t('topics.question_count', { count: node.question_count })}</Badge>
                    {node.status === 'archived' ? <Badge variant='muted'>{t('status_archived')}</Badge> : null}
                </div>
                {canManage ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon' aria-label={t('row_actions')}>
                                <MoreHorizontalIcon className='h-4 w-4' />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                            <DropdownMenuItem onClick={() => setUpsert({ open: true, id: null, parentId: node.id, name: '' })}>
                                <Plus className='mr-2 h-4 w-4' />
                                {t('topics.add_child')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setUpsert({ open: true, id: node.id, parentId: node.parent_id, name: node.name })}
                            >
                                <Pencil className='mr-2 h-4 w-4' />
                                {t('topics.rename')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => statusMutation.mutate(node)}>
                                {node.status === 'active' ? (
                                    <>
                                        <Archive className='mr-2 h-4 w-4' />
                                        {t('archive')}
                                    </>
                                ) : (
                                    <>
                                        <ArchiveRestore className='mr-2 h-4 w-4' />
                                        {t('restore')}
                                    </>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteTarget(node)} className='text-destructive'>
                                <Trash2 className='mr-2 h-4 w-4' />
                                {t('delete')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
            </div>
            {node.children.length > 0 ? (
                <div className='mt-1 space-y-1'>{node.children.map((child) => renderNode(child, depth + 1))}</div>
            ) : null}
        </div>
    );

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('topics.page_title')}
                    subtitle={t('topics.page_subtitle')}
                    breadcrumbs={[
                        { label: t('credits_breadcrumb'), href: `/${locale}/credits` },
                        { label: t('list_title'), href: `/${locale}/credits/questions` },
                        { label: t('topics.page_title') },
                    ]}
                    actions={
                        canManage ? (
                            <Button onClick={() => setUpsert({ open: true, id: null, parentId: null, name: '' })}>
                                <Plus className='mr-2 h-4 w-4' />
                                {t('topics.add_root')}
                            </Button>
                        ) : null
                    }
                />
            }
            contentClassName='space-y-4'
        >
            <label className='flex w-fit items-center gap-2 text-sm'>
                <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(!!v)} />
                {t('topics.show_archived')}
            </label>

            {isLoading ? (
                <div className='space-y-2'>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className='h-11 w-full' />
                    ))}
                </div>
            ) : tree.length === 0 ? (
                <Card className='p-0'>
                    <EmptyState icon={FolderTree} title={t('topics.empty')} className='border-0' />
                </Card>
            ) : (
                <div className='space-y-1'>{tree.map((node) => renderNode(node, 0))}</div>
            )}

            {/* Create / rename dialog */}
            <Dialog
                open={upsert.open}
                onOpenChange={(o) => {
                    if (!o) setUpsert(UPSERT_CLOSED);
                }}
            >
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>{upsert.id != null ? t('topics.dialog_title_edit') : t('topics.dialog_title_create')}</DialogTitle>
                    </DialogHeader>
                    <div className='space-y-2'>
                        <Label htmlFor='topic-name'>{t('topics.name_label')}</Label>
                        <Input
                            id='topic-name'
                            value={upsert.name}
                            autoFocus
                            onChange={(e) => setUpsert((s) => ({ ...s, name: e.target.value }))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && upsert.name.trim() !== '') {
                                    e.preventDefault();
                                    upsertMutation.mutate(upsert);
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => setUpsert(UPSERT_CLOSED)}
                            disabled={upsertMutation.isPending}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            type='button'
                            disabled={upsert.name.trim() === '' || upsertMutation.isPending}
                            onClick={() => upsertMutation.mutate(upsert)}
                        >
                            {upsertMutation.isPending ? t('loading') : t('save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm */}
            <Dialog
                open={deleteTarget !== null}
                onOpenChange={(o) => {
                    if (!o) setDeleteTarget(null);
                }}
            >
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>{t('topics.delete_dialog_title')}</DialogTitle>
                        <DialogDescription>
                            {deleteTarget ? t('topics.delete_dialog_description', { name: deleteTarget.name }) : null}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type='button' variant='outline' onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
                            {t('cancel')}
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            disabled={deleteTarget == null || deleteMutation.isPending}
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
                        >
                            {deleteMutation.isPending ? t('loading') : t('delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}
