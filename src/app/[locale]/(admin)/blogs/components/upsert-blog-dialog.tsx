'use client';

import { useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { FileUploader } from '@/components/ui/file-uploader';
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
    title: z.string().min(1).max(255),
    description: z.string().max(2000),
});

type UpsertBlogValues = z.infer<typeof upsertBlogSchema>;

export interface UpsertBlogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When provided, dialog is in edit mode (overview-only). Null = create mode. */
    blog?: BlogDetail | null;
}

function defaultValues(blog: BlogDetail | null | undefined): UpsertBlogValues {
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
        title: kz?.title ?? '',
        description: kz?.description ?? '',
    };
}

export function UpsertBlogDialog({ open, onOpenChange, blog }: UpsertBlogDialogProps) {
    const t = useTranslations('admin.blogs');
    const locale = useLocale();
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

    const title = form.watch('title');
    useEffect(() => {
        if (!slugTouched) {
            form.setValue('slug', slugify(title ?? ''), { shouldValidate: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, slugTouched]);

    const buildPayload = (values: UpsertBlogValues): BlogUpsertInput => {
        // Edit mode preserves existing translation content; create mode starts blank.
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
                    locale: 'kz',
                    title: values.title,
                    description: values.description ?? '',
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

    // Upload UX is now owned by <FileUploader> (kind-aware validation, progress,
    // toasts, abort) — see the cover_image_label FormField below.

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
                                                        {c.title_kz ?? `#${c.id}`}
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
                                        <p className='text-xs text-muted-foreground'>
                                            {t(
                                                field.value === 'publish'
                                                    ? 'status_hint_publish'
                                                    : 'status_hint_pending'
                                            )}
                                        </p>
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
                                    <FileUploader
                                        kind='cover'
                                        variant='inline'
                                        previewSize='md'
                                        value={field.value ?? ''}
                                        onChange={(url) => field.onChange(url)}
                                        onClear={() => field.onChange('')}
                                        pickFromLibrary
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className='space-y-3'>
                            <FormField
                                control={form.control}
                                name='title'
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
                                name='description'
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
                        </div>

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
