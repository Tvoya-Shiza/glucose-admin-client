'use client';

import { useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CreditTopicSelect } from '@/components/credits/topic-select';
import { createCreditQuestion, updateCreditQuestion } from '@/lib/credits/api';
import type { CreditDifficulty, CreditQuestionRow } from '@/lib/credits/types';

export interface UpsertQuestionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null → create; row → edit. */
    initial: CreditQuestionRow | null;
    /** Pre-selected topic for creates (e.g. the active topic filter). */
    defaultTopicId?: string | null;
}

function buildSchema(t: (key: string) => string) {
    return z.object({
        // `: boolean` blocks TS 5.5 inferred type predicates — keeps the output nullable.
        topic_id: z
            .string()
            .nullable()
            .refine((v): boolean => v != null && v !== '', { message: t('validation_required') }),
        difficulty: z.enum(['A', 'B', 'C']),
        question: z.string().min(1, t('validation_required')),
        answer: z.string().min(1, t('validation_required')),
        score: z.number().int(t('validation_number')).min(1, t('validation_number')),
    });
}

type Values = z.infer<ReturnType<typeof buildSchema>>;

/** Create/edit a bank question (RHF + zod). */
export function UpsertQuestionDialog({ open, onOpenChange, initial, defaultTopicId }: UpsertQuestionDialogProps) {
    const t = useTranslations('admin.credit_questions');
    const qc = useQueryClient();

    const schema = useMemo(() => buildSchema(t), [t]);

    const emptyValues: Values = {
        topic_id: defaultTopicId ?? null,
        difficulty: 'A',
        question: '',
        answer: '',
        score: 1,
    };

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: emptyValues,
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) {
            form.reset(
                initial
                    ? {
                          topic_id: initial.topic?.id ?? null,
                          difficulty: initial.difficulty,
                          question: initial.question,
                          answer: initial.answer,
                          score: initial.score,
                      }
                    : { ...emptyValues, topic_id: defaultTopicId ?? null }
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initial]);

    const mutation = useMutation({
        mutationFn: (values: Values) => {
            const payload = {
                topic_id: values.topic_id as string,
                difficulty: values.difficulty as CreditDifficulty,
                question: values.question.trim(),
                answer: values.answer.trim(),
                score: values.score,
            };
            return initial ? updateCreditQuestion(initial.id, payload) : createCreditQuestion(payload);
        },
        onSuccess: () => {
            toast.success(initial ? t('updated_success') : t('created_success'));
            qc.invalidateQueries({ queryKey: ['admin.credit-questions.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.credits.topics'], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error && err.message ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{initial ? t('upsert_title_edit') : t('upsert_title_create')}</DialogTitle>
                    <DialogDescription>{t('upsert_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='space-y-4'>
                        <div className='grid gap-3 sm:grid-cols-2'>
                            <FormField
                                control={form.control}
                                name='topic_id'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('topic_label')}</FormLabel>
                                        <FormControl>
                                            <CreditTopicSelect
                                                value={field.value ?? null}
                                                onChange={(id) => field.onChange(id)}
                                                placeholder={t('topic_placeholder')}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='difficulty'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('difficulty_label')}</FormLabel>
                                        <FormControl>
                                            <ToggleGroup
                                                type='single'
                                                variant='outline'
                                                value={field.value}
                                                onValueChange={(v) => {
                                                    if (v) field.onChange(v);
                                                }}
                                            >
                                                <ToggleGroupItem value='A'>A</ToggleGroupItem>
                                                <ToggleGroupItem value='B'>B</ToggleGroupItem>
                                                <ToggleGroupItem value='C'>C</ToggleGroupItem>
                                            </ToggleGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name='question'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('question_label')}</FormLabel>
                                    <FormControl>
                                        <Textarea rows={3} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='answer'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('answer_label')}</FormLabel>
                                    <FormControl>
                                        <Textarea rows={4} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='score'
                            render={({ field }) => (
                                <FormItem className='max-w-40'>
                                    <FormLabel>{t('score_label')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type='number'
                                            min={1}
                                            value={field.value === 0 ? '' : field.value}
                                            onChange={(e) => {
                                                const n = Number(e.target.value);
                                                field.onChange(e.target.value === '' || !Number.isFinite(n) ? 0 : n);
                                            }}
                                            onBlur={field.onBlur}
                                            name={field.name}
                                            ref={field.ref}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('loading') : t('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
