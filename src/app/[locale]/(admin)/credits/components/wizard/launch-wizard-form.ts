import { z } from 'zod';
import { CREDIT_DEFAULTS } from '@shared/credits';
import type { CreditDifficulty } from '@/lib/credits/types';

/**
 * Launch wizard — ONE react-hook-form instance drives all 4 steps; per-step
 * `form.trigger(WIZARD_STEP_FIELDS[step])` gates the «Келесі» button.
 */

export function buildLaunchWizardSchema(t: (key: string) => string) {
    return z
        .object({
            student_ids: z.array(z.number().int()).min(1, t('students_required')),
            topic_ids: z.array(z.string()).min(1, t('topics_required')),
            question_count: z.number().int(t('validation_number')).min(1, t('validation_number')).max(50, t('validation_number')),
            difficulty_template: z.array(z.enum(['A', 'B', 'C'])),
            /** Minutes in the UI; the payload sends duration_sec = duration_min * 60. */
            duration_min: z.number().int(t('validation_number')).min(1, t('validation_number')).max(240, t('validation_number')),
            pass_type: z.enum(['percent', 'points']),
            pass_value: z.number().int(t('validation_number')).min(1, t('validation_number')),
        })
        .superRefine((vals, ctx) => {
            if (vals.difficulty_template.length !== vals.question_count) {
                ctx.addIssue({ code: 'custom', path: ['difficulty_template'], message: t('template_length_error') });
            }
            if (vals.pass_type === 'percent' && vals.pass_value > 100) {
                ctx.addIssue({ code: 'custom', path: ['pass_value'], message: t('pass_value_percent_error') });
            }
        });
}

export type LaunchWizardValues = z.infer<ReturnType<typeof buildLaunchWizardSchema>>;

export const LAUNCH_WIZARD_DEFAULTS: LaunchWizardValues = {
    student_ids: [],
    topic_ids: [],
    question_count: CREDIT_DEFAULTS.question_count,
    difficulty_template: [...CREDIT_DEFAULTS.difficulty_template],
    duration_min: Math.round(CREDIT_DEFAULTS.duration_sec / 60),
    pass_type: CREDIT_DEFAULTS.pass_type,
    pass_value: CREDIT_DEFAULTS.pass_value,
};

export const WIZARD_STEP_FIELDS: Record<number, Array<keyof LaunchWizardValues>> = {
    1: ['student_ids'],
    2: ['topic_ids'],
    3: ['question_count', 'difficulty_template', 'duration_min', 'pass_type', 'pass_value'],
};

/** How many questions of each difficulty the current template requires PER TOPIC. */
export function requiredCountsFromTemplate(template: CreditDifficulty[]): Record<CreditDifficulty, number> {
    const counts: Record<CreditDifficulty, number> = { A: 0, B: 0, C: 0 };
    for (const d of template) counts[d] += 1;
    return counts;
}

/**
 * Resize the template to `questionCount` slots: truncate preserving the edited
 * prefix, extend cyclically with the default A A B B C pattern (slot index mod 5).
 */
export function resizeDifficultyTemplate(template: CreditDifficulty[], questionCount: number): CreditDifficulty[] {
    if (questionCount <= 0) return [];
    if (template.length === questionCount) return template;
    if (template.length > questionCount) return template.slice(0, questionCount);
    const pattern = CREDIT_DEFAULTS.difficulty_template;
    const next = [...template];
    while (next.length < questionCount) next.push(pattern[next.length % pattern.length] ?? 'A');
    return next;
}
