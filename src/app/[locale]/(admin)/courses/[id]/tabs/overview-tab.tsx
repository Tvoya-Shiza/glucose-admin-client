'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statusBadgeVariant } from '@/lib/courses/format';
import { resolveAssetUrl } from '@/lib/uploads/asset-url';
import { usePermission } from '@/lib/access/use-permission';
import type { CourseDetail } from '@/lib/courses/types';
import { CoverImageUploader } from '../components/cover-image-uploader';
import { EditCourseForm } from '../components/edit-course-form';
import { TranslationForm } from '../components/translation-form';

export interface OverviewTabProps {
    course: CourseDetail;
    role: 'admin' | 'curator' | 'teacher';
}

/**
 * CRS-01 + CRS-02 (detail half) — Course detail Overview tab (Plan 03).
 *
 * Layout (top to bottom, per plan body):
 *   1. Cover image card (preview + <CoverImageUploaderStub /> — disabled until Plan 04).
 *   2. Two-column grid: side-by-side RU + KZ translation read-only previews
 *      (CONTEXT D-06 — when not editing) OR <EditCourseForm> with both locales when editing.
 *   3. Field grid: slug / status / category / teacher (read-only) / counts.
 *
 * Edit-in-place pattern (mirrors Phase 4 Plan 03 OverviewTab + EditGroupForm):
 *   - Click Edit → <EditCourseForm> takes over the tab body.
 *   - Cancel → return to read-only.
 *   - Save → updateCourse mutation, optimistic-rollback, invalidate list cache,
 *           toast, exit edit mode.
 *
 * Role gating:
 *   - admin: full edit (status, slug, category, teacher-change-tooltip header).
 *   - teacher (own): full edit.
 *   - teacher (foreign) / curator: never reach this tab — admin-api 403s the detail
 *     fetch (CourseDetailClient surfaces the 403 Alert before this tab mounts).
 *
 * Header-level Delete button + (disabled) Change Teacher button live in
 * course-detail-client.tsx, not here. This mirrors Phase 4 Plan 03's separation
 * (destructive / cross-cutting actions in the page header; field edits in the tab).
 */
export function OverviewTab({ course, role }: OverviewTabProps) {
    const t = useTranslations('admin.courses');
    const [editing, setEditing] = useState(false);

    const canEdit = usePermission('courses.edit');

    if (editing && canEdit) {
        return (
            <EditCourseForm
                course={course}
                onCancel={() => setEditing(false)}
                onSaved={() => setEditing(false)}
            />
        );
    }

    const kzTr = course.translations.find((tr) => tr.locale === 'kz');

    return (
        <div className='space-y-5 pt-4'>
            {/* Cover image */}
            <div className='space-y-1'>
                <div className='text-muted-foreground text-sm'>{t('cover_label')}</div>
                {canEdit ? (
                    <CoverImageUploader
                        courseId={course.id}
                        currentCoverUrl={course.image_cover}
                    />
                ) : (
                    <div className='bg-muted text-muted-foreground flex h-24 w-40 items-center justify-center overflow-hidden rounded border text-xs'>
                        {course.image_cover && course.image_cover.length > 0 ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveAssetUrl(course.image_cover)} alt='' className='h-full w-full object-cover' />
                        ) : (
                            <span>{t('cover_label')}</span>
                        )}
                    </div>
                )}
            </div>

            {/* KZ translation (read-only preview) */}
            <TranslationForm
                locale='kz'
                title={kzTr?.title ?? ''}
                description={kzTr?.description ?? ''}
                onTitleChange={() => undefined}
                onDescriptionChange={() => undefined}
                disabled
            />

            {/* Field grid */}
            <div className='space-y-2'>
                <Field label={t('slug_label')} value={course.slug} />
                <FieldNode label={t('status_label')}>
                    <Badge variant={statusBadgeVariant(course.status)}>
                        {course.status === 'active'
                            ? t('status_active')
                            : course.status === 'pending'
                              ? t('status_pending')
                              : course.status === 'is_draft'
                                ? t('status_is_draft')
                                : t('status_inactive')}
                    </Badge>
                </FieldNode>
                <Field
                    label={t('category_label')}
                    value={
                        course.category
                            ? `${course.category.title_kz ?? course.category.slug} (id ${course.category.id})`
                            : '—'
                    }
                />
                <Field
                    label={t('teacher_label')}
                    value={
                        course.teacher
                            ? `${course.teacher.full_name ?? `user#${course.teacher.id}`} (id ${course.teacher.id})`
                            : '—'
                    }
                />
                <Field label={t('col_chapters')} value={String(course.counts.chapter_count)} />
            </div>

            {canEdit ? (
                <div className='flex gap-2 pt-2'>
                    <Button onClick={() => setEditing(true)}>{t('edit')}</Button>
                </div>
            ) : null}
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className='grid grid-cols-3 gap-2 text-sm'>
            <div className='text-muted-foreground'>{label}</div>
            <div className='col-span-2'>{value}</div>
        </div>
    );
}

function FieldNode({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='grid grid-cols-3 gap-2 text-sm'>
            <div className='text-muted-foreground'>{label}</div>
            <div className='col-span-2'>{children}</div>
        </div>
    );
}
