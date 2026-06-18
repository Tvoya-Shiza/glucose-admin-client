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
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FileUploader } from '@/components/ui/file-uploader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { upsertItem } from '@/lib/courses/api';
import type { ChapterItem, ChapterItemType, UpsertItemPayload } from '@/lib/courses/types';
import { parseVideoUrl } from '@/lib/uploads/parse-video-url';
import { resolveAssetUrl } from '@/lib/uploads/asset-url';

type UpsertItemPayloadStorage = NonNullable<UpsertItemPayload['storage']>;
import { EntitySearchPicker } from './entity-search-picker';
import { TiptapEditor } from './tiptap-editor';

type FileSubType = 'rich-text' | 'image' | 'video' | 'pdf';

interface PdfEntry {
    file_url: string;
    name: string;
    volume: string;
}

/** Phase 30 — single optional lecture-notes attachment for a content item. */
interface AttachmentEntry {
    file_url: string;
    file_type: string;
    name: string;
    volume: string;
}

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
        if (!item || item.type !== 'file') return 'rich-text';
        if (item.pdfs && item.pdfs.length > 0) return 'pdf';
        const mime = item.file?.file_type ?? '';
        if (mime === 'application/pdf') return 'pdf';
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'video';
        return 'rich-text';
    }, [item]);

    const initialPdfs = (): PdfEntry[] =>
        item?.pdfs?.map((p) => ({ file_url: p.file, name: p.title, volume: p.volume })) ?? [];

    const initialAttachments = (): AttachmentEntry[] =>
        item?.attachments?.map((a) => ({
            file_url: a.file,
            file_type: a.file_type,
            name: a.title,
            volume: a.volume,
        })) ?? [];

    const [type, setType] = useState<ChapterItemType>(item?.type ?? 'file');
    const [subType, setSubType] = useState<FileSubType>(initialSubType);
    const [kzTitle, setKzTitle] = useState<string>(item?.translations?.find((tr) => tr.locale === 'kz')?.title ?? '');
    const [kzHtml, setKzHtml] = useState<string>(item?.translations?.find((tr) => tr.locale === 'kz')?.description ?? '');
    const [fileUrl, setFileUrl] = useState<string>(item?.file?.file ?? '');
    const [fileType, setFileType] = useState<string>(item?.file?.file_type ?? '');
    const [volume, setVolume] = useState<string>(item?.file?.volume ?? '0');
    const [storage, setStorage] = useState<UpsertItemPayloadStorage>(
        (item?.file?.storage as UpsertItemPayloadStorage | undefined) ?? 'upload',
    );
    // Phase 20 — accessibility now lives on the chapter item itself for all types.
    // Fall back to the linked file.accessibility for legacy responses where the
    // item-level field may be missing (pre-Phase-20 admin-api builds).
    const [accessibility, setAccessibility] = useState<'free' | 'paid'>(
        item?.accessibility ?? item?.file?.accessibility ?? 'free',
    );
    const [pdfs, setPdfs] = useState<PdfEntry[]>(initialPdfs);
    const [attachments, setAttachments] = useState<AttachmentEntry[]>(initialAttachments);
    const [fkId, setFkId] = useState<string>(item && item.type !== 'file' ? String(item.item_id) : '');
    // Phase 16 — per-item "counts toward course completion" toggle. Defaults to true
    // for both new items and existing items that pre-date Phase 16 (the server backfills
    // `is_required=1` for all legacy rows via the column default).
    const [isRequired, setIsRequired] = useState<boolean>(item?.is_required ?? true);

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
            setStorage((item?.file?.storage as UpsertItemPayloadStorage | undefined) ?? 'upload');
            setAccessibility(item?.accessibility ?? item?.file?.accessibility ?? 'free');
            setPdfs(initialPdfs());
            setAttachments(initialAttachments());
            setFkId(item && item.type !== 'file' ? String(item.item_id) : '');
            setIsRequired(item?.is_required ?? true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, item?.id]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (type === 'file') {
                const base: UpsertItemPayload = {
                    id: item?.id,
                    chapter_id: chapterId,
                    type: 'file' as ChapterItemType,
                    item_id: item?.file?.id ?? 0,
                    accessibility,
                    is_required: isRequired,
                    translations: [
                        { locale: 'kz' as const, title: kzTitle, description: subType === 'rich-text' ? kzHtml : undefined },
                    ],
                };
                let payload: UpsertItemPayload;
                // Phase 30 — konspekt (up to 3). Always sent for content sub-types
                // (possibly empty) so removals reach the server. Not sent for the
                // pdf block (its files ARE the content).
                const attachmentsField: UpsertItemPayload['attachments'] = attachments.map((a) => ({
                    file_url: a.file_url,
                    file_type: a.file_type,
                    name: a.name,
                    volume: a.volume,
                }));
                if (subType === 'pdf') {
                    if (pdfs.length === 0) {
                        throw new Error(t('validation_failed'));
                    }
                    payload = {
                        ...base,
                        pdf_files: pdfs.map((p) => ({ file_url: p.file_url, name: p.name, volume: p.volume })),
                    };
                } else if (subType === 'rich-text') {
                    payload = { ...base, file_url: '', file_type: 'text/html', volume: '0', storage: 'upload', attachments: attachmentsField };
                } else {
                    payload = { ...base, file_url: fileUrl, file_type: fileType, volume, storage, attachments: attachmentsField };
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
                is_required: isRequired,
                accessibility,
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
                                        <SelectItem value='pdf'>{t('item_subtype_pdf')}</SelectItem>
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

                    <div className='space-y-1.5'>
                        <Label>{t('item_accessibility_label')}</Label>
                        <div className='flex gap-4'>
                            <label className='inline-flex cursor-pointer items-center gap-2 text-sm'>
                                <input
                                    type='radio'
                                    name='accessibility'
                                    value='free'
                                    checked={accessibility === 'free'}
                                    onChange={() => setAccessibility('free')}
                                />
                                {t('item_accessibility_free')}
                            </label>
                            <label className='inline-flex cursor-pointer items-center gap-2 text-sm'>
                                <input
                                    type='radio'
                                    name='accessibility'
                                    value='paid'
                                    checked={accessibility === 'paid'}
                                    onChange={() => setAccessibility('paid')}
                                />
                                {t('item_accessibility_paid')}
                            </label>
                        </div>
                    </div>

                    {type === 'file' && subType === 'image' ? (
                        <div className='space-y-2 rounded border p-3'>
                            <Label>{t('item_subtype_image')}</Label>
                            <FileUploader
                                kind='image'
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

                    {type === 'file' && subType === 'video' ? (
                        <div className='space-y-2 rounded border p-3'>
                            <Label>{t('item_subtype_video')}</Label>
                            <Tabs defaultValue={fileUrl && /^https?:\/\//.test(fileUrl) && !/^https?:\/\/.*\/uploads\//.test(fileUrl) ? 'url' : 'upload'}>
                                <TabsList>
                                    <TabsTrigger value='upload'>{t('item_video_upload_tab')}</TabsTrigger>
                                    <TabsTrigger value='url'>{t('item_video_url_tab')}</TabsTrigger>
                                </TabsList>
                                <TabsContent value='upload' className='pt-3'>
                                    <FileUploader
                                        kind='video'
                                        variant='inline'
                                        previewSize='md'
                                        value={fileUrl}
                                        onChange={(url, meta) => {
                                            setFileUrl(url);
                                            setFileType(meta.mime);
                                            setVolume(String(meta.size));
                                            setStorage('upload');
                                        }}
                                        onClear={() => {
                                            setFileUrl('');
                                            setFileType('');
                                            setVolume('0');
                                            setStorage('upload');
                                        }}
                                        pickFromLibrary
                                    />
                                </TabsContent>
                                <TabsContent value='url' className='space-y-2 pt-3'>
                                    {/* Textarea (а не Input): длинный URL/<iframe…> сниппет
                                        переносится и блок растёт по высоте (field-sizing-content),
                                        не обрезая текст. parseVideoUrl-логика без изменений. */}
                                    <Textarea
                                        className='min-h-20 font-mono text-xs'
                                        value={fileUrl}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            // parseVideoUrl handles raw URLs AND full
                                            // <iframe …> snippets (extracts src and recurses).
                                            const parsed = parseVideoUrl(raw);
                                            if (parsed) {
                                                setFileUrl(parsed.file);
                                                setFileType(`video/${parsed.storage}`);
                                                setStorage(parsed.storage);
                                                setVolume('0');
                                            } else {
                                                setFileUrl(raw);
                                                setFileType('video/url');
                                                setStorage('iframe');
                                                setVolume('0');
                                            }
                                        }}
                                        placeholder={t('item_video_url_placeholder')}
                                    />
                                    {fileUrl && /^https?:\/\//i.test(fileUrl) ? (
                                        <>
                                            <p className='text-xs text-muted-foreground'>
                                                {t('item_video_url_resolved', { storage })}
                                            </p>
                                            <div className='aspect-video w-full overflow-hidden rounded border bg-muted'>
                                                <iframe
                                                    src={fileUrl}
                                                    title='video-preview'
                                                    className='h-full w-full'
                                                    frameBorder={0}
                                                    allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                                                    allowFullScreen
                                                />
                                            </div>
                                        </>
                                    ) : null}
                                </TabsContent>
                            </Tabs>
                        </div>
                    ) : null}

                    {type === 'file' && subType === 'pdf' ? (
                        <div className='space-y-3 rounded border p-3'>
                            <Label>{t('item_subtype_pdf')}</Label>
                            {pdfs.length > 0 ? (
                                <ul className='space-y-2'>
                                    {pdfs.map((p, idx) => (
                                        <li
                                            key={`${p.file_url}-${idx}`}
                                            className='flex items-center justify-between gap-2 rounded border bg-muted/30 px-3 py-2 text-sm'
                                        >
                                            <a
                                                href={resolveAssetUrl(p.file_url)}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                className='min-w-0 flex-1 truncate text-primary underline'
                                            >
                                                {p.name || p.file_url.split('/').pop()}
                                            </a>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={() => setPdfs((prev) => prev.filter((_, i) => i !== idx))}
                                            >
                                                {t('item_pdf_remove')}
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className='text-xs text-muted-foreground'>{t('item_pdf_empty')}</p>
                            )}
                            <FileUploader
                                kind='document'
                                variant='inline'
                                value=''
                                onChange={(url, meta) => {
                                    if (meta.mime !== 'application/pdf') {
                                        toast.error(t('item_pdf_only'));
                                        return;
                                    }
                                    setPdfs((prev) => [
                                        ...prev,
                                        { file_url: url, name: meta.original_name ?? '', volume: String(meta.size) },
                                    ]);
                                }}
                            />
                            <p className='text-xs text-muted-foreground'>{t('item_pdf_hint')}</p>
                        </div>
                    ) : null}

                    {/* Phase 30 — lecture-notes attachments (konspekt, up to 3) for
                        content items (video / image / rich-text). Any document type. */}
                    {type === 'file' && subType !== 'pdf' ? (
                        <div className='space-y-2 rounded border p-3'>
                            <Label>{t('item_attachment_label')}</Label>
                            <p className='text-xs text-muted-foreground'>{t('item_attachment_hint')}</p>
                            {attachments.length > 0 ? (
                                <ul className='space-y-2'>
                                    {attachments.map((a, idx) => (
                                        <li
                                            key={`${a.file_url}-${idx}`}
                                            className='flex items-center justify-between gap-2 rounded border bg-muted/30 px-3 py-2 text-sm'
                                        >
                                            <a
                                                href={resolveAssetUrl(a.file_url)}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                className='min-w-0 flex-1 truncate text-primary underline'
                                            >
                                                {a.name || a.file_url.split('/').pop()}
                                            </a>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                            >
                                                {t('item_attachment_remove')}
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            {attachments.length < 3 ? (
                                <FileUploader
                                    kind='document'
                                    variant='inline'
                                    value=''
                                    onChange={(url, meta) => {
                                        setAttachments((prev) =>
                                            prev.length >= 3
                                                ? prev
                                                : [
                                                      ...prev,
                                                      {
                                                          file_url: url,
                                                          file_type: meta.mime,
                                                          name: meta.original_name ?? '',
                                                          volume: String(meta.size),
                                                      },
                                                  ],
                                        );
                                    }}
                                />
                            ) : (
                                <p className='text-xs text-muted-foreground'>{t('item_attachment_max')}</p>
                            )}
                        </div>
                    ) : null}

                    {type === 'quiz' ? (
                        <div className='space-y-1.5'>
                            <Label>{t('item_quiz_id_label')}</Label>
                            {/* Attaching a quiz: search the whole catalog, not just
                                quizzes already in this course (quizzes have no course FK). */}
                            <EntitySearchPicker kind='quiz' value={fkId} onChange={setFkId} courseId={courseId} scope='all' />
                        </div>
                    ) : null}
                    {type === 'assignment' ? (
                        <div className='space-y-1.5'>
                            <Label>{t('item_assignment_id_label')}</Label>
                            {/* Attaching an assignment: search the whole catalog. Assignments
                                bound to another course come back disabled ("already linked"). */}
                            <EntitySearchPicker kind='assignment' value={fkId} onChange={setFkId} courseId={courseId} scope='all' />
                        </div>
                    ) : null}

                    <div className='flex items-center justify-between rounded border bg-muted/30 p-3'>
                        <div>
                            <Label htmlFor='item_is_required' className='cursor-pointer'>
                                {t('item_is_required_label')}
                            </Label>
                            <p className='text-xs text-muted-foreground'>
                                {t('item_is_required_hint')}
                            </p>
                        </div>
                        <input
                            id='item_is_required'
                            type='checkbox'
                            checked={isRequired}
                            onChange={(e) => setIsRequired(e.target.checked)}
                            className='h-5 w-5 cursor-pointer'
                        />
                    </div>
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
