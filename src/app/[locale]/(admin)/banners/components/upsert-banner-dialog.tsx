'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { requestUploadToken, uploadFileDirect } from '@/lib/courses/upload-client';
import { createBanner, listBannerCategories, updateBanner } from '@/lib/banners/api';
import type { BannerDetail, BannerStatus, BannerUpsertInput } from '@/lib/banners/types';
import { slugify, SLUG_REGEX } from '@/lib/courses/format';

/**
 * BAN-01 — create + edit dialog for banners. Single component, two modes
 * (controlled by `banner` prop).
 *
 * Mirrors UpsertStoryDialog (Plan 02) MINUS the `icon` field. Banners have
 * `image` + `video` only (per Advertisement schema).
 *
 * Translation `content` is rendered as <Textarea> (NOT Tiptap) per D-08 — banners
 * are simpler than stories.
 *
 * react-hook-form + zod (D-21). Slug auto-fills from RU title via slugify until
 * the user touches the slug field manually.
 *
 * Submission: POST createBanner / PATCH updateBanner. On success: invalidate
 * ['admin.banners.list'] (exact:false) + close + toast.
 */
const upsertBannerSchema = z.object({
    slug: z
        .string()
        .min(1)
        .max(255)
        .refine((v) => SLUG_REGEX.test(v), { message: 'slug_invalid_format' }),
    category_id: z
        .string()
        .min(1)
        .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, { message: 'category_required' }),
    image: z.string().max(255).optional(),
    video: z.string().max(255).optional(),
    status: z.enum(['pending', 'publish']),
    enable_comment: z.boolean(),
    link_type: z.string().max(255).optional(),
    page_type: z.string().max(255).optional(),
    link: z.string().max(255).optional(),
    ru_title: z.string().min(1).max(255),
    ru_description: z.string().max(2000),
    ru_content: z.string().max(50000),
    kz_title: z.string().min(1).max(255),
    kz_description: z.string().max(2000),
    kz_content: z.string().max(50000),
});

type UpsertBannerValues = z.infer<typeof upsertBannerSchema>;

export interface UpsertBannerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When provided, dialog is in edit mode. Null/undefined = create mode. */
    banner?: BannerDetail | null;
}

function defaultValues(banner: BannerDetail | null | undefined): UpsertBannerValues {
    const ru = banner?.translations?.find((t) => t.locale === 'ru');
    const kz = banner?.translations?.find((t) => t.locale === 'kz');
    return {
        slug: banner?.slug ?? '',
        category_id: banner?.category_id ? String(banner.category_id) : '',
        image: banner?.image ?? '',
        video: banner?.video ?? '',
        status: (banner?.status as BannerStatus) ?? 'pending',
        enable_comment: banner?.enable_comment ?? true,
        link_type: banner?.link_type ?? '',
        page_type: banner?.page_type ?? '',
        link: banner?.link ?? '',
        ru_title: ru?.title ?? '',
        ru_description: ru?.description ?? '',
        ru_content: ru?.content ?? '',
        kz_title: kz?.title ?? '',
        kz_description: kz?.description ?? '',
        kz_content: kz?.content ?? '',
    };
}

export function UpsertBannerDialog({ open, onOpenChange, banner }: UpsertBannerDialogProps) {
    const t = useTranslations('admin.banners');
    const qc = useQueryClient();
    const isEdit = !!banner?.id;

    const cats = useQuery({
        queryKey: ['admin.banners.categories'],
        queryFn: () => listBannerCategories(),
        staleTime: 60_000,
        enabled: open,
    });

    const [slugTouched, setSlugTouched] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<UpsertBannerValues>({
        resolver: zodResolver(upsertBannerSchema),
        defaultValues: defaultValues(banner),
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) {
            form.reset(defaultValues(banner));
            setSlugTouched(!!isEdit);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, banner?.id]);

    const ruTitle = form.watch('ru_title');
    useEffect(() => {
        if (!slugTouched) {
            form.setValue('slug', slugify(ruTitle ?? ''), { shouldValidate: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ruTitle, slugTouched]);

    const buildPayload = (values: UpsertBannerValues): BannerUpsertInput => ({
        slug: values.slug,
        category_id: Number(values.category_id),
        image: values.image || null,
        video: values.video || null,
        status: values.status,
        enable_comment: values.enable_comment,
        link_type: values.link_type || null,
        page_type: values.page_type || null,
        link: values.link || null,
        translations: [
            {
                locale: 'ru',
                title: values.ru_title,
                description: values.ru_description ?? '',
                content: values.ru_content ?? '',
            },
            {
                locale: 'kz',
                title: values.kz_title,
                description: values.kz_description ?? '',
                content: values.kz_content ?? '',
            },
        ],
    });

    const mutation = useMutation({
        mutationFn: (values: UpsertBannerValues) => {
            const payload = buildPayload(values);
            return isEdit ? updateBanner(banner!.id, payload) : createBanner(payload);
        },
        onSuccess: (saved) => {
            toast.success(isEdit ? t('updated_toast') : t('created_toast'));
            qc.invalidateQueries({ queryKey: ['admin.banners.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.banners.detail', saved.id], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('save_failed');
            toast.error(msg);
        },
    });

    const onUpload = async (field: 'image', file: File) => {
        try {
            // content_type cast: admin-api validates against allowed_content_types — we
            // pass through the browser-derived MIME and let server reject unsupported.
            const tok = await requestUploadToken({
                kind: 'image' as const,
                size: file.size,
                content_type: file.type as unknown as 'image/jpeg',
            });
            const result = await uploadFileDirect(tok.upload_url, tok.token, file);
            form.setValue(field, result.file_url ?? '', { shouldValidate: true });
            toast.success(t('saved'));
        } catch (e) {
            const msg = e instanceof Error ? e.message : t('save_failed');
            toast.error(msg);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-3xl'>
                <DialogHeader>
                    <DialogTitle>{isEdit ? t('edit_title') : t('create_title')}</DialogTitle>
                    <DialogDescription>{t('list_subtitle')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
                        className='space-y-4'
                    >
                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='slug'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('slug_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={t('slug_placeholder')}
                                                {...field}
                                                onChange={(e) => {
                                                    setSlugTouched(true);
                                                    field.onChange(e.target.value);
                                                }}
                                            />
                                        </FormControl>
                                        <p className='text-xs text-muted-foreground'>
                                            {t('slug_auto_help')}
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='category_id'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('category_label')}</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue
                                                        placeholder={t('category_placeholder')}
                                                    />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {(cats.data ?? []).map((c) => (
                                                    <SelectItem key={c.id} value={String(c.id)}>
                                                        {c.title_ru ?? c.slug}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='status'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('status_label')}</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('status_label')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value='pending'>
                                                    {t('status_pending')}
                                                </SelectItem>
                                                <SelectItem value='publish'>
                                                    {t('status_publish')}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='enable_comment'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('enable_comment_label')}</FormLabel>
                                        <Select
                                            value={field.value ? '1' : '0'}
                                            onValueChange={(v) => field.onChange(v === '1')}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value='1'>
                                                    {t('enable_comment_label')}
                                                </SelectItem>
                                                <SelectItem value='0'>—</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className='grid grid-cols-1 gap-3'>
                            <FormField
                                control={form.control}
                                name='image'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('image_label')}</FormLabel>
                                        <div className='flex gap-2'>
                                            <FormControl>
                                                <Input
                                                    placeholder='https://...'
                                                    value={field.value ?? ''}
                                                    onChange={field.onChange}
                                                />
                                            </FormControl>
                                            <input
                                                ref={imageInputRef}
                                                type='file'
                                                accept='image/*'
                                                hidden
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) void onUpload('image', f);
                                                    e.target.value = '';
                                                }}
                                            />
                                            <Button
                                                type='button'
                                                variant='outline'
                                                onClick={() => imageInputRef.current?.click()}
                                            >
                                                {t('upload_image_button')}
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='video'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('video_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder='https://...'
                                                value={field.value ?? ''}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Tabs defaultValue='ru' className='w-full'>
                            <TabsList className='grid w-full grid-cols-2'>
                                <TabsTrigger value='ru'>{t('ru_translation')}</TabsTrigger>
                                <TabsTrigger value='kz'>{t('kz_translation')}</TabsTrigger>
                            </TabsList>
                            <TabsContent value='ru' className='space-y-3'>
                                <FormField
                                    control={form.control}
                                    name='ru_title'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('title_ru_label')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('title_ru_placeholder')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='ru_description'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('description_ru_label')}</FormLabel>
                                            <FormControl>
                                                <Textarea rows={2} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='ru_content'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('content_ru_label')}</FormLabel>
                                            <FormControl>
                                                <Textarea rows={8} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>
                            <TabsContent value='kz' className='space-y-3'>
                                <FormField
                                    control={form.control}
                                    name='kz_title'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('title_kz_label')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('title_kz_placeholder')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='kz_description'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('description_kz_label')}</FormLabel>
                                            <FormControl>
                                                <Textarea rows={2} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='kz_content'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('content_kz_label')}</FormLabel>
                                            <FormControl>
                                                <Textarea rows={8} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>
                        </Tabs>

                        <DialogFooter>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => onOpenChange(false)}
                                disabled={mutation.isPending}
                            >
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('saving') : t('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
