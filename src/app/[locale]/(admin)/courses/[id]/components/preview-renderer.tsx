'use client';

import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { sanitizeTiptapHtml } from '@/lib/sanitize/sanitize-html';
import { resolveAssetUrl } from '@/lib/uploads/asset-url';
import type { CoursePreview, Locale, PreviewChapterItem } from '@/lib/courses/types';

/**
 * PreviewRenderer — read-only mirror render (Plan 07, CRS-09).
 *
 * Renders the course as the student app would see it, given the visibility data
 * computed server-side (CoursesPreviewService). Content is intentionally STATIC —
 * NO edit affordances, NO dnd-kit handles, NO Tiptap toolbar. Only what a student
 * would render on their reading surface.
 *
 * Anti-impersonation banner (T-05-79 mitigation): the first thing rendered is an
 * Alert clarifying "Preview as student — no real session is changed". The admin's
 * Bearer cookie remains the active credential throughout; this view does NOT swap
 * sessions, set fake cookies, or touch the auth boundary in any way.
 *
 * Sanitize-on-render (T-05-76 mitigation, defense in depth):
 *   Even though Plan 05's mutation path sanitizes Tiptap HTML on save, we re-sanitize
 *   here before `dangerouslySetInnerHTML`. If a row predates the sanitize-on-save
 *   wire-up (or a future bug bypasses it), this is the final defense. The sanitizer
 *   is purely client-side (DOMPurify + jsdom-on-server fallback); see
 *   src/lib/sanitize/sanitize-html.ts.
 *
 * Visibility:
 *   - item.visible_now=false  -> render a "not visible" placeholder (with start_date /
 *                               end_date copy when schedule_window present)
 *   - item.visible_now=true   -> render the full content
 *
 *   When ?group_id is omitted (admin see-everything), every item is visible_now=true
 *   and no placeholders are shown. When a group is selected and an item has no
 *   schedule for that group, the server returns visible_now=false with
 *   schedule_window=null — we surface a "not yet scheduled for this group" copy.
 *
 * Item type rendering (from joined Files row's `file_type` MIME prefix):
 *   - text/* (Tiptap rich text)  -> dangerouslySetInnerHTML(sanitizeTiptapHtml(description))
 *   - image/*                     -> <img>
 *   - video/*                     -> <video controls>
 *   - quiz / assignment           -> "Phase 6 placeholder" copy
 */
export function PreviewRenderer({
    preview,
    locale,
}: {
    preview: CoursePreview;
    locale: Locale;
}) {
    const t = useTranslations('admin.courses');

    const courseTitle =
        preview.translations.find((tr) => tr.locale === locale)?.title ??
        preview.translations.find((tr) => tr.locale === 'kz')?.title ??
        preview.slug;
    const courseDescription =
        preview.translations.find((tr) => tr.locale === locale)?.description ??
        preview.translations.find((tr) => tr.locale === 'kz')?.description ??
        '';

    return (
        <div className='space-y-6'>
            {/* Anti-impersonation banner (T-05-79). Always visible, regardless of group context. */}
            <Alert>
                <AlertTitle>{t('preview_banner_title')}</AlertTitle>
                <AlertDescription>{t('preview_banner_no_real_session')}</AlertDescription>
            </Alert>

            {preview.group_context ? (
                <Alert variant='default' className='bg-muted/50'>
                    <AlertDescription>
                        {t('preview_active_group_context', { name: preview.group_context.name })}
                    </AlertDescription>
                </Alert>
            ) : (
                <Alert variant='default' className='bg-muted/50'>
                    <AlertDescription>
                        {t('preview_no_group_admin_view_active')}
                    </AlertDescription>
                </Alert>
            )}

            {/* Course header: cover, title, description. */}
            <header className='space-y-3'>
                <h1 className='text-2xl font-semibold'>{courseTitle}</h1>
                {preview.image_cover && preview.image_cover.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={resolveAssetUrl(preview.image_cover)}
                        alt={courseTitle}
                        className='max-w-full rounded-md'
                    />
                ) : null}
                {courseDescription ? (
                    <p className='text-muted-foreground whitespace-pre-line'>
                        {courseDescription}
                    </p>
                ) : null}
            </header>

            {/* Chapters + items. */}
            {preview.chapters.length === 0 ? (
                <Alert>
                    <AlertDescription>{t('no_chapters_yet')}</AlertDescription>
                </Alert>
            ) : (
                preview.chapters.map((ch) => {
                    const chTitle =
                        ch.translations.find((tr) => tr.locale === locale)?.title ??
                        ch.translations.find((tr) => tr.locale === 'kz')?.title ??
                        `#${ch.id}`;
                    return (
                        <section key={ch.id} className='space-y-3 border-t pt-4'>
                            <h2 className='text-xl font-semibold'>{chTitle}</h2>
                            {ch.items.length === 0 ? (
                                <p className='text-muted-foreground text-sm'>
                                    {t('no_items_in_chapter')}
                                </p>
                            ) : (
                                ch.items.map((item) => (
                                    <PreviewItem
                                        key={item.id}
                                        item={item}
                                        locale={locale}
                                    />
                                ))
                            )}
                        </section>
                    );
                })
            )}
        </div>
    );
}

function PreviewItem({ item, locale }: { item: PreviewChapterItem; locale: Locale }) {
    const t = useTranslations('admin.courses');

    // Visibility gate.
    if (!item.visible_now) {
        const window = item.schedule_window;
        return (
            <div className='text-muted-foreground rounded-md border border-dashed p-3 text-sm italic'>
                <div>{t('preview_item_not_visible')}</div>
                {window ? (
                    <div className='mt-1 text-xs'>
                        {t('preview_item_window_range', {
                            start: new Date(window.start_date * 1000).toISOString(),
                            end: new Date(window.end_date * 1000).toISOString(),
                        })}
                    </div>
                ) : (
                    <div className='mt-1 text-xs'>{t('preview_item_no_schedule_for_group')}</div>
                )}
            </div>
        );
    }

    // file → derive sub-type from file_type MIME prefix.
    if (item.type === 'file' && item.file) {
        const file = item.file;
        const itemTitle =
            file.translations.find((tr) => tr.locale === locale)?.title ??
            file.translations.find((tr) => tr.locale === 'kz')?.title ??
            '';
        const itemDescription =
            file.translations.find((tr) => tr.locale === locale)?.description ??
            file.translations.find((tr) => tr.locale === 'kz')?.description ??
            '';

        if (file.file_type.startsWith('text/')) {
            // Rich text. Re-sanitize on render (defense in depth — T-05-76).
            return (
                <article className='space-y-2 rounded-md border p-3'>
                    {itemTitle ? <h3 className='font-medium'>{itemTitle}</h3> : null}
                    {itemDescription ? (
                        <div
                            className='prose prose-sm max-w-none'
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{
                                __html: sanitizeTiptapHtml(itemDescription),
                            }}
                        />
                    ) : null}
                </article>
            );
        }
        if (file.file_type.startsWith('image/')) {
            return (
                <figure className='space-y-2 rounded-md border p-3'>
                    {itemTitle ? <h3 className='font-medium'>{itemTitle}</h3> : null}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveAssetUrl(file.file)} alt={itemTitle} className='max-w-full rounded' />
                </figure>
            );
        }
        if (file.file_type.startsWith('video/')) {
            // YouTube / Vimeo / arbitrary iframe targets render in an <iframe>;
            // only locally-hosted binary uploads (storage='upload') use <video>.
            const isEmbed =
                file.storage === 'youtube' ||
                file.storage === 'vimeo' ||
                file.storage === 'iframe';
            return (
                <figure className='space-y-2 rounded-md border p-3'>
                    {itemTitle ? <h3 className='font-medium'>{itemTitle}</h3> : null}
                    {isEmbed ? (
                        <div className='aspect-video w-full overflow-hidden rounded'>
                            <iframe
                                src={file.file}
                                title={itemTitle || 'video'}
                                className='h-full w-full'
                                frameBorder={0}
                                allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                                allowFullScreen
                            />
                        </div>
                    ) : (
                        <video src={resolveAssetUrl(file.file)} controls className='max-w-full rounded' />
                    )}
                </figure>
            );
        }
        // Fallback: unknown MIME — show download link.
        return (
            <div className='space-y-1 rounded-md border p-3'>
                {itemTitle ? <h3 className='font-medium'>{itemTitle}</h3> : null}
                <a
                    href={resolveAssetUrl(file.file)}
                    target='_blank'
                    rel='noreferrer noopener'
                    className='text-primary text-sm underline'
                >
                    {file.file_type} · {file.volume}
                </a>
            </div>
        );
    }

    // Quiz / assignment placeholders (Phase 6 will fill).
    if (item.type === 'quiz') {
        return (
            <div className='rounded-md border p-3'>
                <h3 className='font-medium'>
                    {t('item_type_quiz')} #{item.item_id}
                </h3>
                <p className='text-muted-foreground text-sm'>
                    {t('preview_quiz_assignment_pending_phase_6')}
                </p>
            </div>
        );
    }
    if (item.type === 'assignment') {
        return (
            <div className='rounded-md border p-3'>
                <h3 className='font-medium'>
                    {t('item_type_assignment')} #{item.item_id}
                </h3>
                <p className='text-muted-foreground text-sm'>
                    {t('preview_quiz_assignment_pending_phase_6')}
                </p>
            </div>
        );
    }

    // type='file' but no joined Files row (rare race; show placeholder).
    return (
        <div className='text-muted-foreground rounded-md border p-3 text-sm'>
            {t('item_type_file')} #{item.item_id}
        </div>
    );
}
