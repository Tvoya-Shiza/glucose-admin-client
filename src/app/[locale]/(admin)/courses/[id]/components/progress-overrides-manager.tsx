'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { getCourse } from '@/lib/courses/api';
import { bulkGrantOverrides, bulkRevokeOverrides, listOverrides } from '@/lib/progress-overrides/api';
import type { CourseDetail } from '@/lib/courses/types';
import { ProgressTargetPicker, type ProgressTarget } from './progress-target-picker';

export interface ProgressOverridesManagerProps {
    courseId: number;
}

/**
 * Phase 19 / Feature B1 — content unlock manager.
 *
 * UX:
 *   1. Pick target (user or group) via ProgressTargetPicker.
 *   2. Once target_id is set, fetch current overrides for that target and the
 *      course chapter tree.
 *   3. Render the chapter tree with a checkbox per item. Initially checked
 *      iff an override already exists for that item.
 *   4. "Save" computes the diff (newly-checked → grant; newly-unchecked → revoke)
 *      and fires bulkGrant + bulkRevoke in parallel.
 *
 * Note: this manager only flips the gate-bypass flag. CourseLearning.passed is
 * NEVER written here — the student still has to view/play/scroll to register
 * a completion record. See header of glucose-api/src/modules/courses/utils/access.ts.
 */
export function ProgressOverridesManager({ courseId }: ProgressOverridesManagerProps) {
    const t = useTranslations('admin.progress_overrides');
    const qc = useQueryClient();

    const [target, setTarget] = useState<ProgressTarget>({ kind: 'user', target_id: null });

    // Local checkbox state — sourced from the override list on (re)load, then
    // toggled freely; "Save" applies the diff against `initialChecked`.
    const [checked, setChecked] = useState<Set<number>>(new Set());
    const [initialChecked, setInitialChecked] = useState<Set<number>>(new Set());

    const course = useQuery({
        queryKey: ['admin.courses.detail', courseId],
        queryFn: () => getCourse(courseId),
    });

    const targetReady = target.target_id !== null;
    const overridesKey = ['admin.progress-overrides', courseId, target.kind, target.target_id] as const;

    const overrides = useQuery({
        queryKey: overridesKey,
        queryFn: () =>
            listOverrides(courseId, { target_kind: target.kind, target_id: target.target_id as number }),
        enabled: targetReady,
        staleTime: 15_000,
    });

    // When the override list changes (target swap, server refresh) — reseed
    // both initial + working sets.
    useEffect(() => {
        if (!overrides.data) return;
        const ids = new Set(overrides.data.rows.map((r) => r.item_id));
        setInitialChecked(ids);
        setChecked(new Set(ids));
    }, [overrides.data]);

    const grantMutation = useMutation({
        mutationFn: (ids: number[]) =>
            bulkGrantOverrides(courseId, {
                target: { kind: target.kind, target_id: target.target_id as number },
                item_ids: ids,
            }),
    });

    const revokeMutation = useMutation({
        mutationFn: (ids: number[]) =>
            bulkRevokeOverrides(courseId, {
                target: { kind: target.kind, target_id: target.target_id as number },
                item_ids: ids,
            }),
    });

    const { toGrant, toRevoke } = useMemo(() => {
        const toGrant: number[] = [];
        const toRevoke: number[] = [];
        checked.forEach((id) => {
            if (!initialChecked.has(id)) toGrant.push(id);
        });
        initialChecked.forEach((id) => {
            if (!checked.has(id)) toRevoke.push(id);
        });
        return { toGrant, toRevoke };
    }, [checked, initialChecked]);

    const dirty = toGrant.length > 0 || toRevoke.length > 0;
    const saving = grantMutation.isPending || revokeMutation.isPending;

    async function handleSave() {
        if (!targetReady || !dirty) return;
        try {
            await Promise.all([
                toGrant.length > 0 ? grantMutation.mutateAsync(toGrant) : Promise.resolve(null),
                toRevoke.length > 0 ? revokeMutation.mutateAsync(toRevoke) : Promise.resolve(null),
            ]);
            await qc.invalidateQueries({ queryKey: overridesKey, exact: false });
            toast.success(t('saved_toast', { granted: toGrant.length, revoked: toRevoke.length }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('invalid_items')) toast.error(t('error_invalid_items'));
            else if (msg.includes('course_not_found')) toast.error(t('error_course_not_found'));
            else toast.error(t('error_generic'));
        }
    }

    function handleReset() {
        setChecked(new Set(initialChecked));
    }

    function toggle(id: number, on: boolean) {
        setChecked((prev) => {
            const next = new Set(prev);
            if (on) next.add(id);
            else next.delete(id);
            return next;
        });
    }

    function toggleChapter(chapterItems: number[], on: boolean) {
        setChecked((prev) => {
            const next = new Set(prev);
            for (const id of chapterItems) {
                if (on) next.add(id);
                else next.delete(id);
            }
            return next;
        });
    }

    return (
        <div className='space-y-4'>
            <div className='rounded border bg-card p-3'>
                <p className='mb-3 text-sm font-medium'>{t('manage_target_label')}</p>
                <ProgressTargetPicker value={target} onChange={setTarget} disabled={saving} />
            </div>

            {!targetReady ? (
                <p className='text-sm text-muted-foreground'>{t('manage_pick_target_hint')}</p>
            ) : course.isLoading || overrides.isLoading ? (
                <Skeleton className='h-72 w-full' />
            ) : !course.data ? (
                <p className='text-sm text-muted-foreground'>{t('error_course_not_found')}</p>
            ) : (
                <>
                    <div className='flex items-center justify-end gap-2'>
                        <span className='text-xs text-muted-foreground'>
                            {t('diff_summary', { granted: toGrant.length, revoked: toRevoke.length })}
                        </span>
                        <Button variant='outline' onClick={handleReset} disabled={!dirty || saving}>
                            {t('reset')}
                        </Button>
                        <Button onClick={handleSave} disabled={!dirty || saving}>
                            {saving ? t('saving') : t('save')}
                        </Button>
                    </div>
                    <ChapterTree
                        course={course.data}
                        checked={checked}
                        onToggleItem={toggle}
                        onToggleChapter={toggleChapter}
                        disabled={saving}
                    />
                </>
            )}
        </div>
    );
}

interface ChapterTreeProps {
    course: CourseDetail;
    checked: Set<number>;
    onToggleItem: (itemId: number, on: boolean) => void;
    onToggleChapter: (itemIds: number[], on: boolean) => void;
    disabled?: boolean;
}

function ChapterTree({ course, checked, onToggleItem, onToggleChapter, disabled }: ChapterTreeProps) {
    const t = useTranslations('admin.progress_overrides');
    if (course.chapters.length === 0) {
        return <p className='text-sm text-muted-foreground'>{t('no_content')}</p>;
    }
    return (
        <div className='space-y-3'>
            {course.chapters.map((chapter) => {
                const itemIds = chapter.items.map((i) => i.id);
                const checkedCount = itemIds.filter((id) => checked.has(id)).length;
                const allChecked = itemIds.length > 0 && checkedCount === itemIds.length;
                const someChecked = checkedCount > 0;
                const chapterTitle =
                    chapter.translations.find((tr) => tr.locale === 'kz')?.title ?? `#${chapter.id}`;
                return (
                    <div key={chapter.id} className='rounded border bg-card'>
                        <div className='flex items-center justify-between border-b px-3 py-2'>
                            <div className='flex items-center gap-2'>
                                <Checkbox
                                    checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                                    onCheckedChange={(c) => onToggleChapter(itemIds, c === true)}
                                    disabled={disabled || itemIds.length === 0}
                                />
                                <span className='text-sm font-medium'>{chapterTitle}</span>
                            </div>
                            <span className='text-xs text-muted-foreground'>
                                {checkedCount} / {itemIds.length}
                            </span>
                        </div>
                        {chapter.items.length === 0 ? (
                            <p className='px-3 py-2 text-xs text-muted-foreground'>{t('chapter_empty')}</p>
                        ) : (
                            <ul className='divide-y'>
                                {chapter.items.map((item) => {
                                    const isOn = checked.has(item.id);
                                    const title =
                                        item.file?.file ??
                                        item.quiz?.slug ??
                                        (item.assignment ? `#${item.assignment.id}` : `#${item.item_id}`);
                                    return (
                                        <li key={item.id} className='flex items-center gap-3 px-3 py-2'>
                                            <Checkbox
                                                checked={isOn}
                                                onCheckedChange={(c) => onToggleItem(item.id, c === true)}
                                                disabled={disabled}
                                            />
                                            <span className='flex-1 truncate text-sm'>{title}</span>
                                            <span className='text-xs uppercase text-muted-foreground'>
                                                {item.type}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
