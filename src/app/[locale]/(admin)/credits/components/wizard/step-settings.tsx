'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CreditQuestionDeficit, CreditTopic } from '@/lib/credits/types';
import { DifficultyTemplateEditor } from './difficulty-template-editor';
import { resizeDifficultyTemplate, type LaunchWizardValues } from './launch-wizard-form';

export interface StepSettingsProps {
    form: UseFormReturn<LaunchWizardValues>;
    /** Server-reported 422 `credits.question_deficit` rows (post-submit). */
    deficits: CreditQuestionDeficit[];
    topics: CreditTopic[];
}

function numberFromInput(raw: string): number {
    if (raw.trim() === '') return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Wizard step 3 — per-topic question count, difficulty template editor
 * (auto-resized cyclically A A B B C on question_count change), timer minutes
 * (payload duration_sec) and pass threshold (percent|points toggle + value).
 */
export function StepSettings({ form, deficits, topics }: StepSettingsProps) {
    const t = useTranslations('admin.credits');

    const questionCount = form.watch('question_count');
    const passType = form.watch('pass_type');

    const topicNameById = useMemo(() => new Map(topics.map((topic) => [topic.id, topic.name])), [topics]);

    // Auto-resize the template when question_count changes: truncate preserving
    // the edited prefix, extend cyclically with the default A A B B C pattern.
    useEffect(() => {
        const template = form.getValues('difficulty_template');
        if (questionCount >= 1 && questionCount <= 50 && template.length !== questionCount) {
            form.setValue('difficulty_template', resizeDifficultyTemplate(template, questionCount), {
                shouldValidate: form.formState.isSubmitted,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questionCount]);

    return (
        <div className='space-y-4'>
            {deficits.length > 0 ? (
                <Alert
                    variant='destructive'
                    className='border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                >
                    <TriangleAlert className='h-4 w-4' />
                    <AlertTitle>{t('deficit_title')}</AlertTitle>
                    <AlertDescription>
                        <ul className='list-disc space-y-0.5 pl-4 text-xs'>
                            {deficits.map((d, i) => (
                                <li key={`${d.topic_id}-${d.difficulty}-${i}`}>
                                    {t('deficit_row', {
                                        topic: topicNameById.get(d.topic_id) ?? `#${d.topic_id}`,
                                        difficulty: d.difficulty,
                                        required: d.required,
                                        available: d.available,
                                    })}
                                </li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            ) : null}

            <div className='grid gap-3 sm:grid-cols-2'>
                <FormField
                    control={form.control}
                    name='question_count'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('question_count_label')}</FormLabel>
                            <FormControl>
                                <Input
                                    type='number'
                                    min={1}
                                    max={50}
                                    value={field.value === 0 ? '' : field.value}
                                    onChange={(e) => field.onChange(numberFromInput(e.target.value))}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name='duration_min'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('timer_label')}</FormLabel>
                            <FormControl>
                                <Input
                                    type='number'
                                    min={1}
                                    max={240}
                                    value={field.value === 0 ? '' : field.value}
                                    onChange={(e) => field.onChange(numberFromInput(e.target.value))}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={form.control}
                name='difficulty_template'
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('template_label')}</FormLabel>
                        <FormControl>
                            <DifficultyTemplateEditor value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className='grid gap-3 sm:grid-cols-2'>
                <FormField
                    control={form.control}
                    name='pass_type'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('pass_type_label')}</FormLabel>
                            <FormControl>
                                <ToggleGroup
                                    type='single'
                                    variant='outline'
                                    value={field.value}
                                    onValueChange={(v) => {
                                        if (v) field.onChange(v);
                                    }}
                                >
                                    <ToggleGroupItem value='percent'>{t('pass_type_percent')}</ToggleGroupItem>
                                    <ToggleGroupItem value='points'>{t('pass_type_points')}</ToggleGroupItem>
                                </ToggleGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name='pass_value'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                {t('pass_value_label')}
                                {passType === 'percent' ? ' (%)' : ''}
                            </FormLabel>
                            <FormControl>
                                <Input
                                    type='number'
                                    min={1}
                                    max={passType === 'percent' ? 100 : undefined}
                                    value={field.value === 0 ? '' : field.value}
                                    onChange={(e) => field.onChange(numberFromInput(e.target.value))}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}
