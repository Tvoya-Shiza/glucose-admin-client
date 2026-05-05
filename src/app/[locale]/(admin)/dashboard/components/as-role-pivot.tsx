'use client';

import { useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Phase 9 (D-19, T-09-05-01) — admin-only "view as role" pivot.
 *
 * Visible only when actorRole === 'admin'. Persists the selection in the URL
 * (?as_role=admin|curator|teacher) so support sessions are shareable. The
 * server-side endpoints already gate by @Roles + actor.id — this component
 * never grants extra capability, it only changes which client-side view is
 * rendered.
 *
 * Belt-and-braces: the DashboardRouter computes the effective view as
 *   `actor.role_name === 'admin' ? pivot : actor.role_name`
 * so a non-admin who manually edits ?as_role=admin in the URL bar is ignored.
 */
export const PIVOT_ROLES = ['admin', 'curator', 'teacher'] as const;
export type PivotRole = (typeof PIVOT_ROLES)[number];

interface Props {
    actorRole: string;
}

export function AsRolePivot({ actorRole }: Props) {
    const t = useTranslations('admin.dashboard');
    const fallback: PivotRole =
        actorRole === 'curator' || actorRole === 'teacher' ? actorRole : 'admin';
    const [pivot, setPivot] = useQueryState('as_role', parseAsStringLiteral(PIVOT_ROLES).withDefault(fallback));

    if (actorRole !== 'admin') return null;

    return (
        <div className='flex items-center gap-2'>
            <span className='text-muted-foreground text-sm'>{t('as_role_label')}:</span>
            <Select value={pivot} onValueChange={(v) => setPivot(v as PivotRole)}>
                <SelectTrigger className='w-44'>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='admin'>{t('as_role_admin')}</SelectItem>
                    <SelectItem value='curator'>{t('as_role_curator')}</SelectItem>
                    <SelectItem value='teacher'>{t('as_role_teacher')}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
