'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FileUploader } from '@/components/ui/file-uploader';
import { upsertItem } from '@/lib/courses/api';
import type { ChapterItem, ChapterItemType } from '@/lib/courses/types';
import { TiptapEditor } from './tiptap-editor';

type FileSubType = 'rich-text' | 'image' | 'video';

export interface UpsertItemDialogProps {
    courseId: number;
    chapterId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When present, dialog is in edit mode. */
    item?: ChapterItem | null;
}

/**
 * UpsertItemDialog — create / edit a WebinarChapterItem (CRS-03 + CRS-04).
 *
 * Branches by type + (when type='file') sub-type:
 *
 *   type='file', sub-type='rich-text'
 *     → tabbed RU + KZ TiptapEditor; saves with payload
 *       { type:'file', item_id: existingFileId??0, translations: [{ru,kz}] }.
 *       file_type='text/html', file='', volume='0' (rich-text-only file row).
 *
 *   type='file', sub-type='image' | 'video'
 *     → file picker → requestUploadToken({kind}) → uploadFileDirect → store file_url.
 *       Saves with { type:'file', item_id, file_url, file_type, volume, translations }.
 *
 *   type='quiz' | 'assignment'
 *     → numeric input for the FK target (Phase 6 will add a real picker).
 *
 * Tiptap auto-save: 500ms debounced. The editor's onChange writes to local state;
 * the debounce posts to upsertItem so each keystroke isn't a network call.
 *
 * Sanitization: TiptapEditor sanitizes client-side BEFORE emitting onChange (Plan 01
 * sanitize-html.ts). The admin-api ALSO sanitizes server-side (sanitize-html-server.ts)
 * as the final gate (T-05-30 — defense in depth).
 */
export function UpsertItemDialog({ courseId, chapterId, open, onOpenChange, item }: UpsertItemDialogProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();
    const isEdit = !!item;

    // Derive initial sub-type from existing file MIME prefix.
    const initialSubType: FileSubType = useMemo(() => {
        if (!item || item.type !== 'file' || !item.file) return 'rich-text';
        const mime = item.file.file_type ?? '';
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'video';
        return 'rich-text';
    }, [item]);

    const [type, setType] = useState<ChapterItemType>(item?.type ?? 'file');
    const [subType, setSubType] = useState<FileSubType>(initialSubType);
    const [kzTitle, setKzTitle] = useState<string>(item?.translations?.find((tr) => tr.locale === 'kz')?.title ?? '');
    const [kzHtml, setKzHtml] = useState<string>(item?.translations?.find((tr) => tr.locale === 'kz')?.description ?? '');
    const [fileUrl, setFileUrl] = useState<string>(item?.file?.file ?? '');
    const [fileType, setFileType] = useState<string>(item?.file?.file_type ?? '');
    const [volume, setVolume] = useState<string>(item?.file?.volume ?? '0');
    const [fkId, setFkId] = useState<string>(item && item.type !== 'file' ? String(item.item_id) : '');

    // Reset state when dialog opens on a different item.
    useEffect(() => {
        if (open) {
            setType(item?.type ?? 'file');
            setSubType(initialSubType);
            setKzTitle(item?.translations?.find((tr) => tr.locale === 'kz')?.title ?? '');
            setKzHtml(item?.translations?.find((tr) => tr.locale === 'kz')?.description ?? '');
            setFileUrl(item?.file?.file ?? '');
            setFileType(item?.file?.file_type ?? '');
            setVolume(item?.file?.volume ?? '0');
            setFkId(item && item.type !== 'file' ? String(item.item_id) : '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, item?.id]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (type === 'file') {
                const payload: any = {
                    id: item?.id,
                    chapter_id: chapterId,
                    type: 'file' as ChapterItemType,
                    item_id: item?.file?.id ?? 0,
                    translations: [
                        { locale: 'kz' as const, title: kzTitle, description: subType === 'rich-text' ? kzHtml : undefined },
                    ],
                };
                if (subType === 'rich-text') {
                    payload.file_url = '';
                    payload.file_type = 'text/html';
                    payload.volume = '0';
                } else {
                    payload.file_url = fileUrl;
                    payload.file_type = fileType;
                    payload.volume = volume;
                }
                return upsertItem(courseId, payload);
            }
            // quiz | assignment — numeric FK reference
            const fkNumeric = Number(fkId);
            if (!Number.isFinite(fkNumeric) || fkNumeric < 1) {
                throw new Error(t('validation_failed'));
            }
            return upsertItem(courseId, {
                id: item?.id,
                chapter_id: chapterId,
                type,
                item_id: fkNumeric,
            });
        },
        onSuccess: () => {
            toast.success(t('saved'));
            qc.invalidateQueries({ queryKey: ['admin.courses.detail', courseId] });
            qc.invalidateQueries({ queryKey: ['admin.courses.list'] });
            onOpenChange(false);
        },
        onError: (err: Error) => {
            toast.error(err.message || t('save_failed'));
        },
    });

    // Upload UX is owned by <FileUploader> (kind-aware validation, progress,
    // abort, toasts). onChange receives the URL + metadata; we copy size/mime
    // back to local state so the mutation payload stays unchanged.

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-3xl'>
                <DialogHeader>
                    <DialogTitle>{isEdit ? t('edit_item_dialog_title') : t('create_item_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('item_type_label')}</DialogDescription>
                </DialogHeader>

                <div className='space-y-4'>
                    <div className='grid grid-cols-2 gap-3'>
                        <div className='space-y-1.5'>
                            <Label>{t('item_type_label')}</Label>
                            <Select
                                value={type}
                                onValueChange={(v) => {
                                    const next = v as ChapterItemType;
                                    setType(next);
                                    if (next !== 'file') setSubType('rich-text');
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='file'>{t('item_type_file')}</SelectItem>
                                    <SelectItem value='quiz'>{t('item_type_quiz')}</SelectItem>
                                    <SelectItem value='assignment'>{t('item_type_assignment')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {type === 'file' ? (
                            <div className='space-y-1.5'>
                                <Label>{t('item_subtype_label')}</Label>
                                <Select value={subType} onValueChange={(v) => setSubType(v as FileSubType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='rich-text'>{t('item_subtype_richtext')}</SelectItem>
                                        <SelectItem value='image'>{t('item_subtype_image')}</SelectItem>
                                        <SelectItem value='video'>{t('item_subtype_video')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}
                    </div>

                    {type === 'file' ? (
                        <div className='space-y-3'>
                            <div className='space-y-1.5'>
                                <Label>{t('item_title_label')}</Label>
                                <Input
                                    value={kzTitle}
                                    onChange={(e) => setKzTitle(e.target.value)}
                                    placeholder={t('item_title_placeholder')}
                                />
                            </div>
                            {subType === 'rich-text' ? (
                                <div className='space-y-1.5'>
                                    <Label>{t('description_label')}</Label>
                                    <TiptapEditor initialHtml={kzHtml} onChange={setKzHtml} />
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {type === 'file' && subType !== 'rich-text' ? (
                        <div className='space-y-2 rounded border p-3'>
                            <Label>
                                {subType === 'image' ? t('item_subtype_image') : t('item_subtype_video')}
                            </Label>
                            <FileUploader
                                kind={subType === 'image' ? 'image' : 'video'}
                                variant='inline'
                                previewSize='md'
                                value={fileUrl}
                                onChange={(url, meta) => {
                                    setFileUrl(url);
                                    setFileType(meta.mime);
                                    setVolume(String(meta.size));
                                }}
                                onClear={() => {
                                    setFileUrl('');
                                    setFileType('');
                                    setVolume('0');
                                }}
                                pickFromLibrary
                            />
                        </div>
                    ) : null}

                    {type === 'quiz' ? (
                        <div className='space-y-1.5'>
                            <Label>{t('item_quiz_id_label')}</Label>
                            <Input
                                type='number'
                                min={1}
                                value={fkId}
                                onChange={(e) => setFkId(e.target.value)}
                                placeholder={t('item_quiz_id_placeholder')}
                            />
                        </div>
                    ) : null}
                    {type === 'assignment' ? (
                        <div className='space-y-1.5'>
                            <Label>{t('item_assignment_id_label')}</Label>
                            <Input
                                type='number'
                                min={1}
                                value={fkId}
                                onChange={(e) => setFkId(e.target.value)}
                                placeholder={t('item_assignment_id_placeholder')}
                            />
                        </div>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                        {t('cancel')}
                    </Button>
                    <Button
                        type='button'
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? t('saving_dot') : t('save_item')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
