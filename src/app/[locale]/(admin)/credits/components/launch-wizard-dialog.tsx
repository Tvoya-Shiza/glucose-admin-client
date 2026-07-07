'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import {
    CreditApiError,
    NotEnoughQuestionsError,
    createCreditLaunch,
    getCreditQuestionAvailability,
    listCreditTopics,
    listEligibleStudents,
} from '@/lib/credits/api';
import type { CreateCreditLaunchPayload, CreditQuestionDeficit } from '@/lib/credits/types';
import { LAUNCH_WIZARD_DEFAULTS, WIZARD_STEP_FIELDS, buildLaunchWizardSchema, type LaunchWizardValues } from './wizard/launch-wizard-form';
import { StepStudents } from './wizard/step-students';
import { StepTopics } from './wizard/step-topics';
import { StepSettings } from './wizard/step-settings';
import { StepReview } from './wizard/step-review';

export interface LaunchWizardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    creditId: string;
    creditTitle: string;
}

const STEPS = [1, 2, 3, 4] as const;

/**
 * 4-step launch wizard (custom stepper — no shadcn primitive exists):
 *   1. students (eligible-students, select-all default ON)
 *   2. topics (tree checkboxes + inline A/B/C availability)
 *   3. settings (question_count, difficulty template, timer, pass threshold)
 *   4. review → «Бастау» → createLaunch → conduct console.
 *
 * ONE useForm drives all steps; per-step form.trigger gates «Келесі».
 * 422 `credits.question_deficit` jumps back to step 3 with deficits rendered.
 */
export function LaunchWizardDialog({ open, onOpenChange, creditId, creditTitle }: LaunchWizardDialogProps) {
    const t = useTranslations('admin.credits');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();

    const [step, setStep] = useState<number>(1);
    const [deficits, setDeficits] = useState<CreditQuestionDeficit[]>([]);
    const selectAllInitialized = useRef(false);

    const schema = useMemo(() => buildLaunchWizardSchema(t), [t]);
    const form = useForm<LaunchWizardValues>({
        resolver: zodResolver(schema),
        defaultValues: LAUNCH_WIZARD_DEFAULTS,
        mode: 'onSubmit',
    });

    const studentsQuery = useQuery({
        queryKey: ['admin.credits.eligible-students', creditId],
        queryFn: () => listEligibleStudents(creditId),
        enabled: open,
        staleTime: 0,
    });

    const topicsQuery = useQuery({
        queryKey: ['admin.credits.topics', { include_archived: false }],
        queryFn: () => listCreditTopics(false),
        enabled: open,
        staleTime: 30_000,
    });

    const topicIds = useMemo(() => (topicsQuery.data ?? []).map((topic) => topic.id), [topicsQuery.data]);
    const availabilityQuery = useQuery({
        queryKey: ['admin.credits.question-availability', topicIds],
        queryFn: () => getCreditQuestionAvailability(topicIds),
        enabled: open && topicIds.length > 0,
        staleTime: 15_000,
    });

    // Select-all default ON: pre-check every launchable student once per open.
    useEffect(() => {
        if (!open || selectAllInitialized.current || !studentsQuery.data) return;
        const selectable = studentsQuery.data.filter((s) => !s.passed && s.active_session_id == null).map((s) => s.id);
        form.setValue('student_ids', selectable);
        selectAllInitialized.current = true;
    }, [open, studentsQuery.data, form]);

    // Full reset when the dialog closes.
    useEffect(() => {
        if (!open) {
            form.reset(LAUNCH_WIZARD_DEFAULTS);
            setStep(1);
            setDeficits([]);
            selectAllInitialized.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mutation = useMutation({
        mutationFn: (values: LaunchWizardValues) => {
            const payload: CreateCreditLaunchPayload = {
                student_ids: values.student_ids,
                topic_ids: values.topic_ids,
                question_count: values.question_count,
                difficulty_template: values.difficulty_template,
                duration_sec: values.duration_min * 60,
                pass_type: values.pass_type,
                pass_value: values.pass_value,
            };
            return createCreditLaunch(creditId, payload);
        },
        onSuccess: (launch) => {
            toast.success(t('launch_created'));
            qc.invalidateQueries({ queryKey: ['admin.credits.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.credits.detail', creditId] });
            qc.invalidateQueries({ queryKey: ['admin.credits.launches', creditId], exact: false });
            onOpenChange(false);
            router.push(`/${locale}/credits/${creditId}/launches/${launch.id}`);
        },
        onError: (err: unknown) => {
            if (err instanceof NotEnoughQuestionsError) {
                setDeficits(err.deficits);
                setStep(3);
                toast.error(t('deficit_title'));
                return;
            }
            if (err instanceof CreditApiError) {
                switch (err.code) {
                    case 'credits.already_passed':
                        toast.error(t('error_already_passed'));
                        setStep(1);
                        qc.invalidateQueries({ queryKey: ['admin.credits.eligible-students', creditId] });
                        return;
                    case 'credits.invalid_students':
                        toast.error(t('error_invalid_students'));
                        setStep(1);
                        qc.invalidateQueries({ queryKey: ['admin.credits.eligible-students', creditId] });
                        return;
                    case 'credits.active_session_exists':
                        toast.error(t('error_active_session_exists'));
                        setStep(1);
                        qc.invalidateQueries({ queryKey: ['admin.credits.eligible-students', creditId] });
                        return;
                    case 'credits.pass_value_exceeds_max':
                        toast.error(t('error_pass_value_exceeds_max'));
                        setStep(3);
                        return;
                }
            }
            const msg = err instanceof Error && err.message ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    const goNext = async () => {
        const fields = WIZARD_STEP_FIELDS[step];
        const ok = fields ? await form.trigger(fields) : true;
        if (ok) setStep((s) => Math.min(s + 1, 4));
    };

    const stepLabels: Record<number, string> = {
        1: t('step_students'),
        2: t('step_topics'),
        3: t('step_settings'),
        4: t('step_review'),
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-3xl'>
                <DialogHeader>
                    <DialogTitle>{t('wizard_title', { title: creditTitle })}</DialogTitle>
                    <DialogDescription>{t('wizard_description')}</DialogDescription>
                </DialogHeader>

                {/* Custom stepper header */}
                <ol className='flex items-center gap-2'>
                    {STEPS.map((s) => (
                        <li key={s} className='flex flex-1 items-center gap-2'>
                            <span
                                className={cn(
                                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                    s === step
                                        ? 'bg-primary text-primary-foreground'
                                        : s < step
                                          ? 'bg-primary/15 text-primary'
                                          : 'bg-muted text-muted-foreground'
                                )}
                            >
                                {s}
                            </span>
                            <span className={cn('truncate text-xs', s === step ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                                {stepLabels[s]}
                            </span>
                        </li>
                    ))}
                </ol>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='space-y-4'>
                        <div className='min-h-64'>
                            {step === 1 ? (
                                <StepStudents form={form} students={studentsQuery.data ?? []} loading={studentsQuery.isLoading} />
                            ) : null}
                            {step === 2 ? (
                                <StepTopics
                                    form={form}
                                    topics={topicsQuery.data ?? []}
                                    availability={availabilityQuery.data ?? []}
                                    loading={topicsQuery.isLoading}
                                />
                            ) : null}
                            {step === 3 ? <StepSettings form={form} deficits={deficits} topics={topicsQuery.data ?? []} /> : null}
                            {step === 4 ? (
                                <StepReview form={form} students={studentsQuery.data ?? []} topics={topicsQuery.data ?? []} />
                            ) : null}
                        </div>

                        <DialogFooter className='gap-2'>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => setStep((s) => Math.max(1, s - 1))}
                                disabled={step === 1 || mutation.isPending}
                            >
                                {t('wizard_back')}
                            </Button>
                            {step < 4 ? (
                                <Button type='button' onClick={goNext}>
                                    {t('wizard_next')}
                                </Button>
                            ) : (
                                <Button type='submit' disabled={mutation.isPending}>
                                    {mutation.isPending ? t('loading') : t('wizard_start')}
                                </Button>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
