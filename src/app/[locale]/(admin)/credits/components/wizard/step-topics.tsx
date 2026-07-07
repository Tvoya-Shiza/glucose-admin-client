'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { buildCreditTopicTree, collectTopicSubtreeIds, type CreditTopicNode } from '@/lib/credits/topic-tree';
import type { CreditDifficulty, CreditTopic, CreditTopicAvailability } from '@/lib/credits/types';
import { requiredCountsFromTemplate, type LaunchWizardValues } from './launch-wizard-form';

export interface StepTopicsProps {
    form: UseFormReturn<LaunchWizardValues>;
    topics: CreditTopic[];
    availability: CreditTopicAvailability[];
    loading: boolean;
}

const DIFFICULTIES: CreditDifficulty[] = ['A', 'B', 'C'];

/**
 * Wizard step 2 — topic tree with checkboxes (parent toggles the whole
 * subtree, clones the quizzes categories buildTree approach) + inline
 * per-topic A/B/C availability. Counts short of the CURRENT template's
 * per-topic requirement are highlighted amber for selected topics.
 */
export function StepTopics({ form, topics, availability, loading }: StepTopicsProps) {
    const t = useTranslations('admin.credits');

    const tree = useMemo(() => buildCreditTopicTree(topics), [topics]);
    const availabilityByTopic = useMemo(() => {
        const map = new Map<string, Record<CreditDifficulty, number>>();
        for (const a of availability) map.set(a.topic_id, a.counts);
        return map;
    }, [availability]);

    const template = form.watch('difficulty_template');
    const required = useMemo(() => requiredCountsFromTemplate(template), [template]);

    if (loading) {
        return (
            <div className='space-y-2'>
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className='h-9 w-full' />
                ))}
            </div>
        );
    }

    return (
        <FormField
            control={form.control}
            name='topic_ids'
            render={({ field }) => {
                const selected = new Set(field.value);

                const toggleSubtree = (node: CreditTopicNode, on: boolean) => {
                    const ids = collectTopicSubtreeIds(node);
                    if (on) {
                        field.onChange(Array.from(new Set([...field.value, ...ids])));
                    } else {
                        const remove = new Set(ids);
                        field.onChange(field.value.filter((id) => !remove.has(id)));
                    }
                };

                const renderNode = (node: CreditTopicNode, depth: number): React.ReactNode => {
                    const counts = availabilityByTopic.get(node.id);
                    const isSelected = selected.has(node.id);
                    const hasDeficit = isSelected && DIFFICULTIES.some((d) => required[d] > 0 && (counts?.[d] ?? 0) < required[d]);
                    return (
                        <div key={node.id}>
                            <div
                                className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm ${
                                    hasDeficit ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-muted/60'
                                }`}
                                style={{ marginLeft: depth * 20 }}
                            >
                                <label className='flex min-w-0 flex-1 items-center gap-2'>
                                    <Checkbox checked={isSelected} onCheckedChange={(v) => toggleSubtree(node, !!v)} />
                                    <span className='truncate'>{node.name}</span>
                                </label>
                                <span className='text-muted-foreground flex shrink-0 items-center gap-2 text-xs tabular-nums'>
                                    {DIFFICULTIES.map((d) => {
                                        const have = counts?.[d] ?? 0;
                                        const short = isSelected && required[d] > 0 && have < required[d];
                                        return (
                                            <span key={d} className={short ? 'font-semibold text-amber-600 dark:text-amber-400' : ''}>
                                                {d}: {have}
                                            </span>
                                        );
                                    })}
                                </span>
                            </div>
                            {node.children.map((child) => renderNode(child, depth + 1))}
                        </div>
                    );
                };

                return (
                    <FormItem className='space-y-3'>
                        <p className='text-muted-foreground text-xs'>{t('availability_label')}</p>
                        {tree.length === 0 ? (
                            <p className='text-muted-foreground rounded border border-dashed p-4 text-center text-sm'>
                                {t('topics_empty')}
                            </p>
                        ) : (
                            <div className='max-h-72 space-y-0.5 overflow-auto rounded border p-2'>
                                {tree.map((node) => renderNode(node, 0))}
                            </div>
                        )}
                        <p className='text-muted-foreground text-xs'>{t('topics_selected', { count: field.value.length })}</p>
                        <FormMessage />
                    </FormItem>
                );
            }}
        />
    );
}
