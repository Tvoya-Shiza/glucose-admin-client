'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ExternalLink, FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileLibraryPicker } from '@/components/ui/file-library-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermission } from '@/lib/access/use-permission';
import { addAssignmentAttachment, removeAssignmentAttachment } from '@/lib/assignments/api';
import type { AssignmentDetail } from '@/lib/assignments/types';

interface AttachmentsTabProps {
    detail: AssignmentDetail;
}

/**
 * Attachments tab — wraps `FileLibraryPicker` so admins pick or upload via the
 * existing file-manager (Phase 10 file folders) instead of pasting raw URLs.
 *
 * `kind='document'` is the Phase 14 addition to the shared UploadKind union:
 * PDF / DOC / DOCX / XLS / XLSX / PPT / PPTX / TXT / ZIP up to 50 MB. The
 * file uploader renders a generic doc icon (no inline preview) and the
 * library picker filters server-side via `?kind=document`.
 *
 * Title defaults to the picked file's `original_name` (when available) or
 * the last URL segment; admin can override before saving.
 */
export function AttachmentsTab({ detail }: AttachmentsTabProps) {
    const t = useTranslations('admin.assignments');
    const qc = useQueryClient();
    const canEdit = usePermission('assignments.edit');

    const [pickerOpen, setPickerOpen] = useState(false);
    const [pendingUrl, setPendingUrl] = useState('');
    const [pendingTitle, setPendingTitle] = useState('');

    const add = useMutation({
        mutationFn: async () => {
            if (!pendingTitle.trim() || !pendingUrl.trim()) {
                throw new Error(t('attachment_title_required'));
            }
            await addAssignmentAttachment(detail.id, { title: pendingTitle.trim(), attach: pendingUrl.trim() });
        },
        onSuccess: () => {
            toast.success(t('attachment_added'));
            setPendingUrl('');
            setPendingTitle('');
            qc.invalidateQueries({ queryKey: ['admin.assignments.detail', detail.id] });
        },
        onError: (e: Error) => toast.error(t('save_failed'), { description: e.message }),
    });

    const remove = useMutation({
        mutationFn: async (id: number) => removeAssignmentAttachment(detail.id, id),
        onSuccess: () => {
            toast.success(t('attachment_removed'));
            qc.invalidateQueries({ queryKey: ['admin.assignments.detail', detail.id] });
        },
        onError: (e: Error) => toast.error(t('save_failed'), { description: e.message }),
    });

    const remaining = 5 - detail.attachments.length;
    const atCap = remaining <= 0;

    return (
        <Card>
            <CardContent className='space-y-4 p-4'>
                <div>
                    <div className='font-medium'>{t('attachments_title')}</div>
                    <div className='text-sm text-muted-foreground'>{t('attachments_subtitle')}</div>
                </div>

                {detail.attachments.length === 0 ? (
                    <div className='rounded border border-dashed py-6 text-center text-sm text-muted-foreground'>
                        {t('attachments_empty')}
                    </div>
                ) : (
                    <ul className='space-y-2'>
                        {detail.attachments.map((a) => (
                            <li key={a.id} className='flex items-center justify-between rounded border p-3'>
                                <div className='min-w-0'>
                                    <div className='truncate font-medium'>{a.title}</div>
                                    <a
                                        href={a.attach}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
                                    >
                                        <ExternalLink className='h-3 w-3' />
                                        {a.attach}
                                    </a>
                                </div>
                                {canEdit ? (
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => remove.mutate(a.id)}
                                        disabled={remove.isPending}
                                    >
                                        <Trash2 className='mr-1 h-4 w-4' />
                                        {t('attachment_remove')}
                                    </Button>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}

                {canEdit ? (
                    <div className='space-y-3 rounded border bg-muted/30 p-3'>
                        <div className='text-sm font-medium'>
                            {atCap ? t('attachments_cap_reached') : t('attachments_remaining', { count: remaining })}
                        </div>

                        <div className='flex flex-wrap gap-2'>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => setPickerOpen(true)}
                                disabled={atCap}
                            >
                                <FolderOpen className='mr-1 h-4 w-4' />
                                {t('attachment_pick_from_library')}
                            </Button>
                        </div>

                        {pendingUrl.length > 0 ? (
                            <div className='space-y-2 rounded border bg-background p-3'>
                                <div className='space-y-1.5'>
                                    <Label>{t('attachment_title_label')}</Label>
                                    <Input
                                        value={pendingTitle}
                                        onChange={(e) => setPendingTitle(e.target.value)}
                                        placeholder={t('attachment_title_placeholder')}
                                    />
                                </div>
                                <div className='space-y-1.5'>
                                    <Label>{t('attachment_url_label')}</Label>
                                    <Input value={pendingUrl} readOnly disabled />
                                </div>
                                <div className='flex justify-end gap-2'>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => {
                                            setPendingUrl('');
                                            setPendingTitle('');
                                        }}
                                    >
                                        {t('cancel')}
                                    </Button>
                                    <Button onClick={() => add.mutate()} disabled={add.isPending}>
                                        {add.isPending ? t('saving_dot') : t('attachment_add')}
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                <FileLibraryPicker
                    open={pickerOpen}
                    onOpenChange={setPickerOpen}
                    kind='document'
                    onPick={(url, meta) => {
                        setPendingUrl(url);
                        const titleFromMeta = meta?.original_name?.trim();
                        const fallbackTitle = url.split('/').pop()?.split('?')[0] ?? '';
                        setPendingTitle(titleFromMeta || fallbackTitle);
                        setPickerOpen(false);
                    }}
                />
            </CardContent>
        </Card>
    );
}
