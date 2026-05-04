'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
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
import { createBlog, listBlogCategories, updateBlog } from '@/lib/blogs/api';
import type { BlogDetail, BlogStatus, BlogUpsertInput } from '@/lib/blogs/types';
import { slugify, SLUG_REGEX } from '@/lib/courses/format';

/**
 * BLG-01 — create + simple-edit dialog for blogs.
 *
 * **Create mode is the canonical path.** Tiptap content lives on the detail page
 * (Plan 04 lock — option (b) in plan body). After successful create, redirect to
 * `/[locale]/blogs/[id]` so the author can compose RU/KZ Tiptap content.
 *
 * Fields: slug, category, image (Phase 5 upload-token, kind='cover'), status,
 * enable_comment, RU/KZ Tabs each with title + short description (Textarea).
 *
 * NO Tiptap inside this dialog — too cramped + the detail page has the canonical
 * editor. Create mode posts an empty `content: ''` for each translation; user
 * fills it on the detail page next.
 */
const upsertBlogSchema = z.object({
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
    status: z.enum(['pending', 'publish']),
    enable_comment: z.boolean(),
    link_type: z.string().max(255).optional(),
    page_type: z.string().max(255).optional(),
    link: z.string().max(255).optional(),
    ru_title: z.string().min(1).max(255),
    ru_description: z.string().max(2000),
    kz_title: z.string().min(1).max(255),
    kz_description: z.string().max(2000),
});

type UpsertBlogValues = z.infer<typeof upsertBlogSchema>;

export interface UpsertBlogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When provided, dialog is in edit mode (overview-only). Null = create mode. */
    blog?: BlogDetail | null;
}

function defaultValues(blog: BlogDetail | null | undefined): UpsertBlogValues {
    const ru = blog?.translations?.find((t) => t.locale === 'ru');
    const kz = blog?.translations?.find((t) => t.locale === 'kz');
    return {
        slug: blog?.slug ?? '',
        category_id: blog?.category_id ? String(blog.category_id) : '',
        image: blog?.image ?? '',
        status: (blog?.status as BlogStatus) ?? 'pending',
        enable_comment: blog?.enable_comment ?? true,
        link_type: blog?.link_type ?? '',
        page_type: blog?.page_type ?? '',
        link: blog?.link ?? '',
        ru_title: ru?.title ?? '',
        ru_description: ru?.description ?? '',
        kz_title: kz?.title ?? '',
        kz_description: kz?.description ?? '',
    };
}

export function UpsertBlogDialog({ open, onOpenChange, blog }: UpsertBlogDialogProps) {
    const t = useTranslations('admin.blogs');
    const locale = useLocale() as 'ru' | 'kz';
    const router = useRouter();
    const qc = useQueryClient();
    const isEdit = !!blog?.id;

    const cats = useQuery({
        queryKey: ['admin.blogs.categories'],
        queryFn: () => listBlogCategories(),
        staleTime: 60_000,
        enabled: open,
    });

    const [slugTouched, setSlugTouched] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<UpsertBlogValues>({
        resolver: zodResolver(upsertBlogSchema),
        defaultValues: defaultValues(blog),
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) {
            form.reset(defaultValues(blog));
            setSlugTouched(!!isEdit);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, blog?.id]);

    const ruTitle = form.watch('ru_title');
    useEffect(() => {
        if (!slugTouched) {
            form.setValue('slug', slugify(ruTitle ?? ''), { shouldValidate: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ruTitle, slugTouched]);

    const buildPayload = (values: UpsertBlogValues): BlogUpsertInput => {
        // Edit mode preserves existing translation content; create mode starts blank.
        const ru = blog?.translations?.find((t) => t.locale === 'ru');
        const kz = blog?.translations?.find((t) => t.locale === 'kz');
        return {
            slug: values.slug,
            category_id: Number(values.category_id),
            image: values.image || null,
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
                    content: ru?.content ?? '',
                },
                {
                    locale: 'kz',
                    title: values.kz_title,
                    description: values.kz_description ?? '',
                    content: kz?.content ?? '',
                },
            ],
        };
    };

    const mutation = useMutation({
        mutationFn: (values: UpsertBlogValues) => {
            const payload = buildPayload(values);
            return isEdit ? updateBlog(blog!.id, payload) : createBlog(payload);
        },
        onSuccess: (saved) => {
            toast.success(isEdit ? t('updated_toast') : t('created_toast'));
            qc.invalidateQueries({ queryKey: ['admin.blogs.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.blogs.detail', saved.id], exact: false });
            onOpenChange(false);
            // Navigate to detail page after create so the author can compose Tiptap content.
            if (!isEdit) {
                router.push(`/${locale}/blogs/${saved.id}`);
            }
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('save_failed');
            toast.error(msg);
        },
    });

    const onUpload = async (file: File) => {
        try {
            // kind='cover' (10 MB cap per Phase 5 Plan 04). content_type cast: admin-api
            // validates against allowed_content_types — pass through browser MIME and let
            // server reject unsupported.
            const tok = await requestUploadToken({
                kind: 'cover' as const,
                size: file.size,
                content_type: file.type as unknown as 'image/jpeg',
            });
            const result = await uploadFileDirect(tok.upload_url, tok.token, file);
            form.setValue('image', result.file_url ?? '', { shouldValidate: true });
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
                                                        {c.title_ru ?? `#${c.id}`}
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

                        <FormField
                            control={form.control}
                            name='image'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('cover_image_label')}</FormLabel>
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
                                            accept='image/jpeg,image/png,image/webp'
                                            hidden
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) void onUpload(f);
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
                                                <Textarea rows={3} {...field} />
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
                                                <Textarea rows={3} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>
                        </Tabs>

                        {!isEdit ? (
                            <p className='text-xs text-muted-foreground'>{t('content_after_create_hint')}</p>
                        ) : null}

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
