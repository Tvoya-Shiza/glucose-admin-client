'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    BookOpen,
    Calendar,
    CheckCircle2,
    Clock,
    Coins,
    GraduationCap,
    ImageOff,
    LayoutGrid,
    Lock,
    Pencil,
    ShieldCheck,
    Tag,
    User,
    XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { statusBadgeVariant } from '@/lib/courses/format';
import { resolveAssetUrl } from '@/lib/uploads/asset-url';
import { usePermission } from '@/lib/access/use-permission';
import type { CourseDetail } from '@/lib/courses/types';
import { CoverImageUploader } from '../components/cover-image-uploader';
import { EditCourseForm } from '../components/edit-course-form';

export interface OverviewTabProps {
    course: CourseDetail;
    role: 'admin' | 'curator' | 'teacher';
}

/**
 * CRS-01 + CRS-02 — Course detail Overview tab.
 *
 * View-mode (default): card-grouped read-only summary of every editable field —
 * cover, KZ title+description, slug/status/category/teacher, pricing, completion
 * settings (Phase 16: strict_progress + required-item count). No need to click
 * "Edit" to see what's configured.
 *
 * Edit-mode: takes over the tab with <EditCourseForm>. Cancel or save returns
 * to view-mode.
 */
export function OverviewTab({ course }: OverviewTabProps) {
    const t = useTranslations('admin.courses');
    const [editing, setEditing] = useState(false);

    const canEdit = usePermission('courses.edit');

    const kzTr = course.translations.find((tr) => tr.locale === 'kz');

    const itemStats = useMemo(() => {
        let total = 0;
        let required = 0;
        for (const ch of course.chapters) {
            for (const it of ch.items) {
                total++;
                if (it.is_required) required++;
            }
        }
        return { total, required, optional: total - required };
    }, [course.chapters]);

    if (editing && canEdit) {
        return (
            <EditCourseForm
                course={course}
                onCancel={() => setEditing(false)}
                onSaved={() => setEditing(false)}
            />
        );
    }

    const coverUrl = course.image_cover && course.image_cover.length > 0 ? resolveAssetUrl(course.image_cover) : null;

    return (
        <div className='space-y-4 pt-4'>
            {/* Header card: cover + title + status badges + edit button */}
            <Card>
                <CardContent className='flex flex-col gap-4 sm:flex-row sm:items-start'>
                    {/* Cover */}
                    <div className='shrink-0'>
                        {canEdit ? (
                            <CoverImageUploader courseId={course.id} currentCoverUrl={course.image_cover} />
                        ) : (
                            <div className='bg-muted text-muted-foreground flex h-32 w-52 items-center justify-center overflow-hidden rounded-lg border'>
                                {coverUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={coverUrl} alt='' className='h-full w-full object-cover' />
                                ) : (
                                    <ImageOff className='h-6 w-6 opacity-60' />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Title block */}
                    <div className='flex min-w-0 flex-1 flex-col gap-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <Badge variant={statusBadgeVariant(course.status)}>
                                {course.status === 'active'
                                    ? t('status_active')
                                    : course.status === 'pending'
                                      ? t('status_pending')
                                      : course.status === 'is_draft'
                                        ? t('status_is_draft')
                                        : t('status_inactive')}
                            </Badge>
                            {course.is_paid ? (
                                <Badge variant='secondary' className='gap-1'>
                                    <Coins className='h-3 w-3' />
                                    {t('badge_paid')}
                                </Badge>
                            ) : (
                                <Badge variant='outline' className='gap-1'>
                                    {t('badge_free')}
                                </Badge>
                            )}
                            {course.strict_progress ? (
                                <Badge variant='default' className='gap-1'>
                                    <ShieldCheck className='h-3 w-3' />
                                    {t('badge_strict_progress')}
                                </Badge>
                            ) : null}
                            <span className='text-muted-foreground text-xs'>#{course.id}</span>
                        </div>
                        <h2 className='text-xl font-semibold leading-tight'>
                            {kzTr?.title && kzTr.title.length > 0 ? kzTr.title : <span className='text-muted-foreground italic'>{t('no_title_kz')}</span>}
                        </h2>
                        <code className='text-muted-foreground w-fit rounded bg-muted px-2 py-0.5 text-xs'>{course.slug}</code>
                    </div>

                    {canEdit ? (
                        <Button onClick={() => setEditing(true)} variant='outline' size='sm' className='shrink-0 gap-1.5'>
                            <Pencil className='h-3.5 w-3.5' />
                            {t('edit')}
                        </Button>
                    ) : null}
                </CardContent>
            </Card>

            {/* Two-column grid: meta + completion */}
            <div className='grid gap-4 lg:grid-cols-2'>
                {/* Meta card */}
                <Card>
                    <CardHeader>
                        <CardTitle className='text-sm font-medium text-muted-foreground'>{t('section_meta')}</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-3 text-sm'>
                        <MetaRow icon={Tag} label={t('category_label')}>
                            {course.category ? (
                                <span>
                                    {course.category.title_kz ?? course.category.slug}
                                    <span className='text-muted-foreground'> · #{course.category.id}</span>
                                </span>
                            ) : (
                                <span className='text-muted-foreground'>—</span>
                            )}
                        </MetaRow>
                        <MetaRow icon={User} label={t('teacher_label')}>
                            {course.teacher ? (
                                <span>
                                    {course.teacher.full_name ?? `user#${course.teacher.id}`}
                                    <span className='text-muted-foreground'> · #{course.teacher.id}</span>
                                </span>
                            ) : (
                                <span className='text-muted-foreground'>—</span>
                            )}
                        </MetaRow>
                        <MetaRow icon={LayoutGrid} label={t('col_chapters')}>
                            <span>
                                {course.counts.chapter_count}
                                <span className='text-muted-foreground'>
                                    {' · '}
                                    {t('items_count', { count: itemStats.total })}
                                </span>
                            </span>
                        </MetaRow>
                        <MetaRow icon={Calendar} label={t('schedules_count_label')}>
                            <span>{course.counts.schedule_count}</span>
                        </MetaRow>
                        <MetaRow icon={Clock} label={t('duration_label')}>
                            {course.duration != null && course.duration > 0 ? (
                                <span>{formatDurationMinutes(course.duration, t)}</span>
                            ) : (
                                <span className='text-muted-foreground'>—</span>
                            )}
                        </MetaRow>
                    </CardContent>
                </Card>

                {/* Completion + pricing card */}
                <Card>
                    <CardHeader>
                        <CardTitle className='text-sm font-medium text-muted-foreground'>{t('section_completion_pricing')}</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-3 text-sm'>
                        <MetaRow icon={course.strict_progress ? ShieldCheck : XCircle} label={t('strict_progress_short')}>
                            {course.strict_progress ? (
                                <span className='inline-flex items-center gap-1.5'>
                                    <span>{t('on')}</span>
                                    <span className='text-muted-foreground text-xs'>{t('strict_progress_hint_short')}</span>
                                </span>
                            ) : (
                                <span className='text-muted-foreground'>{t('off')}</span>
                            )}
                        </MetaRow>
                        <MetaRow icon={CheckCircle2} label={t('required_items_label')}>
                            <span>
                                {itemStats.required}
                                <span className='text-muted-foreground'> / {itemStats.total}</span>
                                {itemStats.optional > 0 ? (
                                    <span className='text-muted-foreground text-xs'>
                                        {' · '}
                                        {t('optional_items_count', { count: itemStats.optional })}
                                    </span>
                                ) : null}
                            </span>
                        </MetaRow>
                        <Separator />
                        <MetaRow icon={course.is_paid ? Lock : BookOpen} label={t('pricing_is_paid_label')}>
                            {course.is_paid ? (
                                <span>{t('on')}</span>
                            ) : (
                                <span className='text-muted-foreground'>{t('off')}</span>
                            )}
                        </MetaRow>
                        {course.is_paid && course.pricing ? (
                            <>
                                <MetaRow icon={Coins} label={t('pricing_price_label')}>
                                    <span className='tabular-nums'>
                                        {formatPrice(course.pricing.price)}
                                    </span>
                                </MetaRow>
                                <MetaRow icon={Calendar} label={t('pricing_access_days_label')}>
                                    <span>{t('access_days_value', { count: course.pricing.access_days })}</span>
                                </MetaRow>
                            </>
                        ) : null}
                    </CardContent>
                </Card>
            </div>

            {/* Description card */}
            <Card>
                <CardHeader>
                    <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
                        <GraduationCap className='h-4 w-4' />
                        {t('section_translation_kz')}
                    </CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                    {kzTr?.description && kzTr.description.length > 0 ? (
                        <div
                            className='prose prose-sm dark:prose-invert max-w-none'
                            // The description is rich-text HTML from TiptapEditor, sanitized server-side.
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{ __html: kzTr.description }}
                        />
                    ) : (
                        <p className='text-muted-foreground text-sm italic'>{t('no_description_kz')}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function MetaRow({
    icon: Icon,
    label,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className='flex items-start gap-3'>
            <Icon className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' />
            <div className='min-w-0 flex-1'>
                <div className='text-muted-foreground text-xs'>{label}</div>
                <div className='break-words'>{children}</div>
            </div>
        </div>
    );
}

/**
 * Decimal-as-string from admin-api (CLAUDE.md BigInt/Decimal note) → user-readable.
 * Strips trailing .000 / .00 / .0, groups thousands by space.
 */
function formatPrice(decimalString: string): string {
    const trimmed = decimalString.replace(/\.0+$/, '');
    const [intPart = '0', fracPart] = trimmed.split('.');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return fracPart ? `${grouped}.${fracPart} ₸` : `${grouped} ₸`;
}

/**
 * Minutes → "X сағ Y мин" (or "Y мин" when X=0, "X сағ" when Y=0).
 * Falls back to a plain minutes badge for absurdly large values so the cell never
 * overflows. `t` is passed in so the labels respect the active locale.
 */
function formatDurationMinutes(
    totalMinutes: number,
    t: ReturnType<typeof useTranslations>,
): string {
    if (totalMinutes <= 0) return t('duration_unknown');
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return t('duration_minutes_value', { minutes });
    if (minutes === 0) return t('duration_hours_value', { hours });
    return t('duration_hours_minutes_value', { hours, minutes });
}
