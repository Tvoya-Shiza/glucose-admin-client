'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Plus, Trash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteBadge, listBadges } from '@/lib/quizzes/api';
import type { QuizBadgeRow } from '@/lib/quizzes/types';
import { UpsertBadgeDialog } from './components/upsert-badge-dialog';

/**
 * QZ-05 — list page for QuizBadge ("Пробные ЕНТ").
 *
 * Card grid (3-col on lg). Each card surfaces:
 *   - RU title (primary), KZ title (muted) — falls back to "#{id}" for empty.
 *   - is_active state badge (active|inactive — soft-delete via PATCH).
 *   - item_count + results_count metrics.
 *   - "Открыть" link to detail page.
 *   - Edit / Delete dropdown actions.
 *
 * "Создать пробное ЕНТ" button opens UpsertBadgeDialog (mode='create').
 *
 * Empty state: localized prompt with primary CTA.
 *
 * Soft-delete posture: DELETE flips is_active=false on the server. UI re-fetches
 * the list and the card flips to "Скрыто" (badge_inactive). Re-activation is via
 * Edit dialog → toggle is_active=true.
 */
export function BadgesListClient() {
    const t = useTranslations('admin.quizzes');
    const locale = useLocale();
    const qc = useQueryClient();

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['admin.quiz-badges.list'],
        queryFn: listBadges,
    });

    const [createOpen, setCreateOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<QuizBadgeRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<QuizBadgeRow | null>(null);

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteBadge(id),
        onSuccess: () => {
            toast.success(t('badge_delete_success'));
            qc.invalidateQueries({ queryKey: ['admin.quiz-badges.list'] });
            setDeleteTarget(null);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    return (
        <div className='space-y-4 p-4'>
            <div className='flex items-center justify-between'>
                <div>
                    <h1 className='text-2xl font-bold'>{t('badges_page_title')}</h1>
                    <p className='text-muted-foreground text-sm'>{t('badges_page_subtitle')}</p>
                </div>
                <Button type='button' onClick={() => setCreateOpen(true)}>
                    <Plus className='mr-2 h-4 w-4' />
                    {t('create_badge')}
                </Button>
            </div>

            {isLoading ? (
                <div className='text-muted-foreground p-6'>{t('loading')}</div>
            ) : rows.length === 0 ? (
                <div className='text-muted-foreground rounded border border-dashed p-10 text-center'>
                    {t('badges_empty')}
                </div>
            ) : (
                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                    {rows.map((row) => {
                        const ruTitle = row.translations.ru?.trim() ?? '';
                        const kzTitle = row.translations.kz?.trim() ?? '';
                        const headerLabel = ruTitle.length > 0 ? ruTitle : `#${row.id}`;
                        return (
                            <Card key={row.id} className='flex flex-col'>
                                <CardHeader className='space-y-2'>
                                    <div className='flex items-start justify-between gap-2'>
                                        <CardTitle className='line-clamp-2 break-words text-base'>
                                            {headerLabel}
                                        </CardTitle>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant='ghost'
                                                    size='icon'
                                                    className='h-7 w-7 shrink-0'
                                                    aria-label={t('row_actions')}
                                                >
                                                    <MoreHorizontal className='h-4 w-4' />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align='end'>
                                                <DropdownMenuItem onSelect={() => setEditTarget(row)}>
                                                    <Pencil className='mr-2 h-4 w-4' />
                                                    {t('edit_badge')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onSelect={() => setDeleteTarget(row)}
                                                    className='text-destructive'
                                                >
                                                    <Trash className='mr-2 h-4 w-4' />
                                                    {t('delete_badge')}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    {kzTitle.length > 0 ? (
                                        <p className='text-muted-foreground line-clamp-1 text-xs'>
                                            {kzTitle}
                                        </p>
                                    ) : null}
                                </CardHeader>
                                <CardContent className='mt-auto space-y-3'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <Badge variant={row.is_active ? 'default' : 'secondary'}>
                                            {row.is_active ? t('badge_active') : t('badge_inactive')}
                                        </Badge>
                                        <span className='text-muted-foreground text-xs'>
                                            {t('badge_item_count', { count: row.item_count })}
                                        </span>
                                        <span className='text-muted-foreground text-xs'>
                                            {t('badge_results_count', { count: row.results_count })}
                                        </span>
                                    </div>
                                    <Link
                                        href={`/${locale}/quizzes/badges/${row.id}`}
                                        className='text-primary inline-block text-sm hover:underline'
                                    >
                                        {t('badge_open')} →
                                    </Link>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <UpsertBadgeDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                initial={undefined}
            />

            <UpsertBadgeDialog
                open={editTarget != null}
                onOpenChange={(open) => {
                    if (!open) setEditTarget(null);
                }}
                initial={
                    editTarget
                        ? {
                              id: editTarget.id,
                              is_active: editTarget.is_active,
                              quiz_category_id: editTarget.quiz_category_id,
                              ru_title: editTarget.translations.ru ?? '',
                              kz_title: editTarget.translations.kz ?? '',
                          }
                        : undefined
                }
            />

            <Dialog
                open={deleteTarget != null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            >
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>{t('delete_badge_dialog_title')}</DialogTitle>
                        <DialogDescription>
                            {t('delete_badge_dialog_description')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => setDeleteTarget(null)}
                            disabled={deleteMutation.isPending}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                        >
                            {deleteMutation.isPending
                                ? t('loading')
                                : t('delete_badge')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
