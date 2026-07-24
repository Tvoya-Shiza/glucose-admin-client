'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { usePermission } from '@/lib/access/use-permission';
import { BookPublishBlockedError, getBook, publishBook } from '@/lib/ebooks/api';
import type { BookRow, BookStatus } from '@/lib/ebooks/types';
import { DeleteBookDialog } from '../components/delete-book-dialog';
import { bookStatusVariant } from '../ebooks-table';
import { MetadataTab } from './tabs/metadata-tab';
import { PagesTab } from './tabs/pages-tab';

const TABS = ['metadata', 'pages'] as const;
type TabKey = (typeof TABS)[number];

/**
 * Phase 39/40 — tabbed book detail (ТЗ §6.0 admin).
 *
 * Tabs: Мәліметтер (metadata) / Беттер (pages) — URL state via nuqs `?tab=`.
 * Mirrors trainer-detail-client structure.
 *
 * Detail query keyed `['admin.ebooks.detail', bookId]` so the MetadataTab save
 * and every page mutation invalidate it (page_count lives on the detail).
 *
 * Publishing is a THREE-value enum (draft/active/inactive), not the trainers'
 * binary toggle: the header offers "publish" while the book is draft/inactive
 * and "hide" while it is active. A 409 publish_blocked (zero pages) surfaces as
 * a reason toast — the Беттер tab is where that gets fixed.
 */
export function BookDetailClient({ bookId }: { bookId: number }) {
    const t = useTranslations('admin.ebooks');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();
    const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('metadata'));

    const canPublish = usePermission('ebooks.publish');
    const canDelete = usePermission('ebooks.delete');
    const canPagesManage = usePermission('ebooks.pages_manage');

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.ebooks.detail', bookId],
        queryFn: () => getBook(bookId),
        retry: false,
    });

    const [deleteOpen, setDeleteOpen] = useState(false);

    const publishMutation = useMutation({
        mutationFn: (next: BookStatus) => publishBook(bookId, { status: next }),
        onSuccess: (result) => {
            toast.success(result.status === 'active' ? t('publish_success') : t('hide_success'));
            qc.invalidateQueries({ queryKey: ['admin.ebooks.detail', bookId] });
            qc.invalidateQueries({ queryKey: ['admin.ebooks.list'], exact: false });
        },
        onError: (err: unknown) => {
            if (err instanceof BookPublishBlockedError) {
                toast.error(t('publish_blocked', { pages: err.page_count }));
                return;
            }
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    if (isLoading) {
        return (
            <div className='space-y-3 p-6'>
                <Skeleton className='h-10 w-1/3' />
                <Skeleton className='h-72 w-full' />
            </div>
        );
    }

    if (error || !data) {
        const msg = error instanceof Error ? error.message : '';
        const isForbidden = msg.includes('403');
        const isNotFound = msg.includes('404');
        return (
            <div className='p-6'>
                <Alert variant='destructive'>
                    <AlertTitle>{isForbidden ? t('forbidden_scope') : isNotFound ? t('not_found') : t('generic_error')}</AlertTitle>
                    {!isForbidden && !isNotFound ? <AlertDescription>{msg}</AlertDescription> : null}
                </Alert>
            </div>
        );
    }

    const safeTab: TabKey = (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : 'metadata';
    const headerTitle = data.title_kz?.trim() || `#${data.id}`;

    // DeleteBookDialog accepts a BookRow — synthesize one from the detail
    // (mirrors the trainer-detail-client synthesis pattern).
    const synthesizedRow: BookRow = {
        id: data.id,
        title_kz: data.title_kz,
        subject: data.subject,
        publisher: data.publisher,
        grade: data.grade,
        language: data.language,
        year: data.year,
        cover_image: data.cover_image,
        page_count: data.page_count,
        status: data.status,
        created_at: data.created_at,
    };

    return (
        <TooltipProvider>
            <PageShell
                header={
                    <PageHeader
                        title={headerTitle}
                        subtitle={t('detail_subtitle', { pages: data.page_count })}
                        breadcrumbs={[{ label: t('list_title'), href: `/${locale}/ebooks` }, { label: headerTitle }]}
                        badge={<Badge variant={bookStatusVariant(data.status)}>{t(`status_${data.status}`)}</Badge>}
                        actions={
                            <>
                                {canPublish ? (
                                    <Button
                                        variant='outline'
                                        disabled={publishMutation.isPending}
                                        onClick={() => publishMutation.mutate(data.status === 'active' ? 'inactive' : 'active')}
                                    >
                                        {data.status === 'active' ? (
                                            <>
                                                <EyeOff className='mr-2 h-4 w-4' />
                                                {t('hide')}
                                            </>
                                        ) : (
                                            <>
                                                <Eye className='mr-2 h-4 w-4' />
                                                {t('publish')}
                                            </>
                                        )}
                                    </Button>
                                ) : null}
                                {canDelete ? (
                                    <Button variant='destructive' onClick={() => setDeleteOpen(true)}>
                                        {t('delete')}
                                    </Button>
                                ) : null}
                            </>
                        }
                    />
                }
                contentClassName='space-y-4'
            >
                <Tabs value={safeTab} onValueChange={(v) => setTab(v)}>
                    <TabsList variant='line' className='w-full justify-start'>
                        <TabsTrigger value='metadata'>{t('metadata_tab')}</TabsTrigger>
                        <TabsTrigger value='pages'>{t('pages_tab')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value='metadata'>
                        <MetadataTab book={data} />
                    </TabsContent>
                    <TabsContent value='pages'>
                        {safeTab === 'pages' ? <PagesTab bookId={bookId} canManage={canPagesManage} /> : null}
                    </TabsContent>
                </Tabs>

                {canDelete ? (
                    <DeleteBookDialog
                        open={deleteOpen}
                        onOpenChange={setDeleteOpen}
                        book={synthesizedRow}
                        onDeleted={() => router.push(`/${locale}/ebooks`)}
                    />
                ) : null}
            </PageShell>
        </TooltipProvider>
    );
}
