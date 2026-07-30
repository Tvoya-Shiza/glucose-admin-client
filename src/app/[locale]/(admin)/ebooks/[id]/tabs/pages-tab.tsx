'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/admin/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileUploader } from '@/components/ui/file-uploader';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/lib/access/use-permission';
import { deleteBookPage, listBookPages, reindexBook, replaceBookPages } from '@/lib/ebooks/api';
import type { BookPageRow, ReplacePageInput } from '@/lib/ebooks/types';
import { BulkPagesUpload, type BulkUploadedPage } from '../components/bulk-pages-upload';
import { PdfImport } from '../components/pdf-import';

interface PageDraft {
    /** Stable React key — page_number is editable, so it can't be the key. */
    key: string;
    page_number: string;
    image_url: string | null;
    text_content: string;
    /** Server-reported "this page already has OCR text" flag (the text itself is never listed). */
    has_text: boolean;
    is_new: boolean;
    dirty: boolean;
}

let draftSeq = 0;
function nextKey(): string {
    draftSeq += 1;
    return `d${draftSeq}`;
}

function toDraft(row: BookPageRow): PageDraft {
    return {
        key: nextKey(),
        page_number: String(row.page_number),
        image_url: row.image_url,
        text_content: '',
        has_text: row.has_text,
        is_new: false,
        dirty: false,
    };
}

/**
 * Phase 39/40 — book Беттер (pages) tab (ТЗ §6.0).
 *
 * The editor keeps a local draft list seeded from GET /ebooks/:id/pages and
 * submits ONLY the rows the operator touched through the single batch endpoint
 * PUT /ebooks/:id/pages. Untouched pages are never sent — the endpoint upserts
 * by (book_id, page_number) and leaves unlisted pages alone.
 *
 * ⚠ Text-preservation caveat (API contract, NOT a UI choice): the batch upsert's
 * SQL is `ON DUPLICATE KEY UPDATE image_url = VALUES(image_url), text_content =
 * VALUES(text_content)` with `?? null` on both fields — so a page sent WITHOUT
 * text_content has its stored text NULLED, despite the DTO doc claiming
 * per-field merge. The list endpoint only reports `has_text` (never the text
 * itself), so the client cannot round-trip existing text. We therefore warn
 * before saving any touched page that already has text but has an empty
 * textarea, and require an explicit confirmation.
 *
 * Deleting a page addresses it by page_number (DELETE :bookId/pages/:pageNumber).
 * Every mutation moves books.page_count server-side, so the book detail query is
 * invalidated too — the publish gate (page_count > 0) reads from it.
 */
export function PagesTab({ bookId, canManage }: { bookId: number; canManage: boolean }) {
    const t = useTranslations('admin.ebooks');
    const qc = useQueryClient();
    const canReindex = usePermission('ebooks.edit');

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.ebooks.pages', bookId],
        queryFn: () => listBookPages(bookId),
        refetchOnWindowFocus: false,
    });

    // `null` = "not seeded yet / re-seed from the next server payload". Every
    // successful mutation resets it so fresh server truth wins over the draft.
    const [drafts, setDrafts] = useState<PageDraft[] | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<PageDraft | null>(null);
    const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);

    useEffect(() => {
        if (data && drafts === null) setDrafts(data.rows.map(toDraft));
    }, [data, drafts]);

    const rows = drafts ?? [];
    const dirtyRows = useMemo(() => rows.filter((r) => r.dirty), [rows]);
    const wipeRisk = useMemo(() => dirtyRows.filter((r) => r.has_text && r.text_content.trim() === ''), [dirtyRows]);

    const patch = (key: string, next: Partial<PageDraft>) => {
        setDrafts((prev) => (prev ?? []).map((r) => (r.key === key ? { ...r, ...next, dirty: true } : r)));
    };

    const addRow = () => {
        setDrafts((prev) => {
            const list = prev ?? [];
            const maxNumber = list.reduce((acc, r) => Math.max(acc, Number(r.page_number) || 0), 0);
            return [
                ...list,
                {
                    key: nextKey(),
                    page_number: String(maxNumber + 1),
                    image_url: null,
                    text_content: '',
                    has_text: false,
                    is_new: true,
                    dirty: true,
                },
            ];
        });
    };

    const dropLocalRow = (key: string) => setDrafts((prev) => (prev ?? []).filter((r) => r.key !== key));

    /**
     * Пачка загруженных сканов превращается в строки страниц, продолжая нумерацию
     * с последней занятой. Строки помечаются dirty и уходят обычным «Сақтау» —
     * одним PUT на всю книгу, а не по запросу на страницу.
     */
    const appendUploadedPages = (uploaded: BulkUploadedPage[]) => {
        setDrafts((prev) => {
            const list = prev ?? [];
            let next = list.reduce((acc, r) => Math.max(acc, Number(r.page_number) || 0), 0);
            const added: PageDraft[] = uploaded.map((page) => ({
                key: nextKey(),
                page_number: String(++next),
                image_url: page.image_url,
                text_content: '',
                has_text: false,
                is_new: true,
                dirty: true,
            }));
            return [...list, ...added];
        });
        toast.success(t('bulk_upload_added', { count: uploaded.length }));
    };

    const invalidateAll = () => {
        setDrafts(null);
        qc.invalidateQueries({ queryKey: ['admin.ebooks.pages', bookId] });
        qc.invalidateQueries({ queryKey: ['admin.ebooks.detail', bookId] });
        qc.invalidateQueries({ queryKey: ['admin.ebooks.list'], exact: false });
    };

    const saveMutation = useMutation({
        mutationFn: () => {
            const pages: ReplacePageInput[] = [];
            const seen = new Set<number>();
            for (const r of dirtyRows) {
                const n = Number(r.page_number.trim());
                if (!Number.isInteger(n) || n < 1) throw new Error(t('pages_number_invalid'));
                if (seen.has(n)) throw new Error(t('pages_number_duplicate', { number: n }));
                seen.add(n);
                pages.push({
                    page_number: n,
                    image_url: r.image_url && r.image_url.length > 0 ? r.image_url : null,
                    text_content: r.text_content.trim() === '' ? null : r.text_content,
                });
            }
            if (pages.length === 0) throw new Error(t('pages_nothing_to_save'));
            return replaceBookPages(bookId, { pages });
        },
        onSuccess: (result) => {
            toast.success(t('pages_saved_success', { count: result.upserted, total: result.page_count }));
            invalidateAll();
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (draft: PageDraft) => deleteBookPage(bookId, Number(draft.page_number)),
        onSuccess: () => {
            toast.success(t('pages_delete_success'));
            setDeleteTarget(null);
            invalidateAll();
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    const reindexMutation = useMutation({
        mutationFn: () => reindexBook(bookId),
        onSuccess: (result) => {
            if (result.ok) {
                toast.success(t('reindex_success', { indexed: result.indexed }));
            } else {
                toast.warning(t('reindex_skipped', { reason: result.reason ?? '' }));
            }
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    const submit = () => {
        if (wipeRisk.length > 0) {
            setConfirmWipeOpen(true);
            return;
        }
        saveMutation.mutate();
    };

    if (isLoading) {
        return (
            <div className='space-y-3'>
                <Skeleton className='h-10 w-1/3' />
                <Skeleton className='h-64 w-full' />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant='destructive'>
                <AlertTitle>{t('generic_error')}</AlertTitle>
                <AlertDescription>{(error as Error).message}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className='space-y-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <p className='text-muted-foreground text-sm'>{t('pages_total', { total: rows.length })}</p>
                <div className='flex items-center gap-2'>
                    {canReindex ? (
                        <Button variant='outline' onClick={() => reindexMutation.mutate()} disabled={reindexMutation.isPending}>
                            <RefreshCw className='mr-2 h-4 w-4' />
                            {reindexMutation.isPending ? t('loading') : t('reindex')}
                        </Button>
                    ) : null}
                    {canManage ? (
                        <Button variant='outline' onClick={addRow}>
                            <Plus className='mr-2 h-4 w-4' />
                            {t('pages_add_row')}
                        </Button>
                    ) : null}
                </div>
            </div>

            {canManage ? (
                <PdfImport
                    bookId={bookId}
                    nextPageNumber={rows.reduce((acc, r) => Math.max(acc, Number(r.page_number) || 0), 0) + 1}
                    onImported={invalidateAll}
                    disabled={saveMutation.isPending}
                />
            ) : null}

            {canManage ? <BulkPagesUpload onUploaded={appendUploadedPages} disabled={saveMutation.isPending} /> : null}

            {rows.length === 0 ? (
                <Card className='p-0'>
                    <EmptyState title={t('pages_empty')} subtitle={canManage ? t('pages_empty_hint') : undefined} />
                </Card>
            ) : (
                <Card className='overflow-hidden p-0'>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className='w-24'>{t('pages_col_number')}</TableHead>
                                <TableHead className='w-72'>{t('pages_col_image')}</TableHead>
                                <TableHead>{t('pages_col_text')}</TableHead>
                                {canManage ? <TableHead className='w-12'>{t('actions')}</TableHead> : null}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r) => (
                                <TableRow key={r.key}>
                                    <TableCell className='align-top'>
                                        <Input
                                            inputMode='numeric'
                                            className='w-20'
                                            value={r.page_number}
                                            disabled={!canManage}
                                            onChange={(e) => patch(r.key, { page_number: e.target.value.replace(/[^\d]/g, '') })}
                                        />
                                    </TableCell>
                                    <TableCell className='align-top'>
                                        <FileUploader
                                            kind='image'
                                            variant='thumb'
                                            previewSize='sm'
                                            value={r.image_url}
                                            onChange={(url) => patch(r.key, { image_url: url })}
                                            onClear={() => patch(r.key, { image_url: null })}
                                            disabled={!canManage}
                                            pickFromLibrary
                                        />
                                    </TableCell>
                                    <TableCell className='align-top'>
                                        <div className='space-y-1'>
                                            <Textarea
                                                rows={2}
                                                value={r.text_content}
                                                disabled={!canManage}
                                                placeholder={t('pages_text_placeholder')}
                                                onChange={(e) => patch(r.key, { text_content: e.target.value })}
                                            />
                                            <div className='flex items-center gap-2'>
                                                <Badge variant={r.has_text ? 'info' : 'muted'}>
                                                    {r.has_text ? t('pages_has_text') : t('pages_no_text')}
                                                </Badge>
                                                {r.dirty ? <Badge variant='warning'>{t('pages_row_dirty')}</Badge> : null}
                                            </div>
                                        </div>
                                    </TableCell>
                                    {canManage ? (
                                        <TableCell className='align-top'>
                                            <Button
                                                variant='ghost'
                                                size='icon'
                                                aria-label={t('pages_row_remove')}
                                                onClick={() => (r.is_new ? dropLocalRow(r.key) : setDeleteTarget(r))}
                                            >
                                                <Trash2 className='text-destructive h-4 w-4' />
                                            </Button>
                                        </TableCell>
                                    ) : null}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {canManage && wipeRisk.length > 0 ? (
                <Alert variant='destructive'>
                    <AlertTitle>{t('pages_text_wipe_title')}</AlertTitle>
                    <AlertDescription>{t('pages_text_wipe_description', { count: wipeRisk.length })}</AlertDescription>
                </Alert>
            ) : null}

            {canManage ? (
                <div className='flex justify-end gap-2'>
                    <Button variant='outline' onClick={() => setDrafts(null)} disabled={saveMutation.isPending || dirtyRows.length === 0}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={submit} disabled={saveMutation.isPending || dirtyRows.length === 0}>
                        {saveMutation.isPending ? t('loading') : t('pages_save', { count: dirtyRows.length })}
                    </Button>
                </div>
            ) : null}

            <Dialog open={confirmWipeOpen} onOpenChange={setConfirmWipeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('pages_text_wipe_title')}</DialogTitle>
                        <DialogDescription>{t('pages_text_wipe_description', { count: wipeRisk.length })}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setConfirmWipeOpen(false)}>
                            {t('cancel')}
                        </Button>
                        <Button
                            variant='destructive'
                            onClick={() => {
                                setConfirmWipeOpen(false);
                                saveMutation.mutate();
                            }}
                        >
                            {t('pages_text_wipe_confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleteTarget !== null}
                onOpenChange={(o) => {
                    if (!o) setDeleteTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('pages_delete_title')}</DialogTitle>
                        <DialogDescription>{t('pages_delete_description', { number: deleteTarget?.page_number ?? '' })}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
                            {t('cancel')}
                        </Button>
                        <Button
                            variant='destructive'
                            disabled={deleteMutation.isPending || deleteTarget === null}
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
                        >
                            {deleteMutation.isPending ? t('loading') : t('delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
