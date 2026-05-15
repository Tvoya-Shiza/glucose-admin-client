'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TiptapEditor } from '../../courses/[id]/components/tiptap-editor';
import { resolveAssetUrl } from '@/lib/uploads/asset-url';
import { getBlog, updateBlog } from '@/lib/blogs/api';
import type { BlogDetail } from '@/lib/blogs/types';
import { AuthorChangeDialog } from '../components/author-change-dialog';

export interface BlogDetailClientProps {
    blogId: number;
}

/**
 * BLG-01 / D-10 — blog detail/edit page.
 *
 * Two tabs:
 *   - **Overview:** read-only summary + "Сменить автора" button (admin-only) which
 *     opens AuthorChangeDialog (BLG-03 / D-11). Other Overview fields (slug,
 *     category, status, image, link_*) are edited via the list-page UpsertBlogDialog
 *     for now; this page focuses on the rich-text composition surface.
 *   - **Content:** RU + KZ Tabs each hosting a TiptapEditor (Phase 5 Plan 05 reuse —
 *     direct import path). Saves via PATCH updateBlog() with only translations.
 *     Server-side sanitize runs in admin-api before persistence (T-07-04-02).
 *
 * Cache invalidation: ['admin.blogs.detail', id] and ['admin.blogs.list'] on any save.
 */
export function BlogDetailClient({ blogId }: BlogDetailClientProps) {
    const t = useTranslations('admin.blogs');
    const locale = useLocale();
    const qc = useQueryClient();

    const detail = useQuery({
        queryKey: ['admin.blogs.detail', blogId],
        queryFn: () => getBlog(blogId),
        staleTime: 30_000,
    });

    const blog: BlogDetail | undefined = detail.data;

    const kzInitial = blog?.translations?.find((tr) => tr.locale === 'kz')?.content ?? '';
    const kzTitle = blog?.translations?.find((tr) => tr.locale === 'kz')?.title ?? '';
    const kzDescription = blog?.translations?.find((tr) => tr.locale === 'kz')?.description ?? '';

    const [kzContent, setKzContent] = useState(kzInitial);
    const [authorOpen, setAuthorOpen] = useState(false);

    // Sync local content when initial detail loads / changes.
    useEffect(() => {
        if (blog) {
            setKzContent(kzInitial);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blog?.id]);

    const saveContent = useMutation({
        mutationFn: () =>
            updateBlog(blogId, {
                // Title + description preserved from current state; content is what we're editing.
                translations: [
                    { locale: 'kz', title: kzTitle, description: kzDescription, content: kzContent },
                ],
            }),
        onSuccess: () => {
            toast.success(t('updated_toast'));
            qc.invalidateQueries({ queryKey: ['admin.blogs.detail', blogId], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.blogs.list'], exact: false });
        },
        onError: (e: Error) => toast.error(e.message ?? t('save_failed')),
    });

    if (detail.isLoading) {
        return (
            <div className='space-y-3 p-6'>
                <Skeleton className='h-8 w-1/3' />
                <Skeleton className='h-48 w-full' />
            </div>
        );
    }
    if (detail.error || !blog) {
        return (
            <div className='p-6 text-sm text-destructive'>
                {(detail.error as Error)?.message ?? t('error_generic')}
            </div>
        );
    }

    return (
        <div className='flex h-full flex-col'>
            <header className='flex items-center justify-between p-6'>
                <div>
                    <h1 className='text-2xl font-semibold'>{kzTitle || blog.slug}</h1>
                    <p className='text-muted-foreground text-sm'>
                        <Link href={`/${locale}/blogs`} className='hover:underline'>
                            ← {t('list_title')}
                        </Link>
                        {' · '}
                        <span className='font-mono'>#{blog.id}</span>
                        {' · '}
                        <Badge variant={blog.status === 'publish' ? 'default' : 'secondary'}>
                            {t(`status_badge_${blog.status}`)}
                        </Badge>
                    </p>
                </div>
            </header>

            <Tabs defaultValue='overview' className='flex-1 px-6 pb-6'>
                <TabsList>
                    <TabsTrigger value='overview'>{t('overview_tab')}</TabsTrigger>
                    <TabsTrigger value='content'>{t('content_tab')}</TabsTrigger>
                </TabsList>

                <TabsContent value='overview' className='space-y-4 pt-4'>
                    <dl className='grid grid-cols-2 gap-3 text-sm'>
                        <div>
                            <dt className='text-muted-foreground'>{t('slug_label')}</dt>
                            <dd className='font-mono'>{blog.slug}</dd>
                        </div>
                        <div>
                            <dt className='text-muted-foreground'>{t('category_label')}</dt>
                            <dd>
                                {blog.category?.title_kz ?? `#${blog.category_id}`}
                            </dd>
                        </div>
                        <div>
                            <dt className='text-muted-foreground'>{t('cover_image_label')}</dt>
                            <dd>
                                {blog.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={resolveAssetUrl(blog.image)} alt='' className='mt-1 h-20 w-32 rounded object-cover' />
                                ) : (
                                    '—'
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className='text-muted-foreground'>{t('col_author')}</dt>
                            <dd className='flex items-center gap-2'>
                                <span>{blog.author?.full_name ?? `#${blog.author_id}`}</span>
                                {blog.author?.role_name ? (
                                    <span className='text-xs text-muted-foreground'>· {blog.author.role_name}</span>
                                ) : null}
                                <Button size='sm' variant='outline' onClick={() => setAuthorOpen(true)}>
                                    {t('change_author')}
                                </Button>
                            </dd>
                        </div>
                        <div>
                            <dt className='text-muted-foreground'>{t('title_kz_label')}</dt>
                            <dd>{kzTitle || '—'}</dd>
                        </div>
                    </dl>
                </TabsContent>

                <TabsContent value='content' className='space-y-4 pt-4'>
                    <div className='space-y-2 pt-3'>
                        <p className='text-xs text-muted-foreground'>{t('content_editor_label')}</p>
                        <TiptapEditor initialHtml={kzInitial} onChange={setKzContent} />
                    </div>

                    <div className='flex justify-end'>
                        <Button onClick={() => saveContent.mutate()} disabled={saveContent.isPending}>
                            {saveContent.isPending ? t('saving') : t('save')}
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>

            <AuthorChangeDialog
                open={authorOpen}
                onOpenChange={setAuthorOpen}
                blog={blog}
            />
        </div>
    );
}
