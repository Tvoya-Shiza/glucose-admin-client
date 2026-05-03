'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { listGroups } from '@/lib/groups/api';

/**
 * GroupContextPicker — Phase 5 Plan 06.
 *
 * Loads /api/proxy/v1/admin/groups (Phase 4 listGroups) and renders a shadcn Select.
 * The Schedule tab uses this to scope its rows to one group at a time (CONTEXT D-18).
 *
 * Page-size note: requesting 200 groups in one shot is generous for the staging
 * dataset. Real production deployments with more groups should add server-side
 * pagination + autocomplete; deferred as a future polish.
 *
 * Scope: the listGroups endpoint already applies GROUP_SCOPE_RULES on the server
 * (admin sees all; curator narrows by supervisor; teacher gets default-deny). For
 * Plan 06, the Schedule tab itself only renders for admin / teacher (curators are
 * forbidden upstream by the controller @Roles); a teacher will typically receive
 * an empty list because teachers are not assigned as supervisors. The Schedule tab
 * surfaces a friendly "no groups available" hint via the empty-list path.
 */
export function GroupContextPicker({
    value,
    onChange,
}: {
    value: string | null;
    onChange: (v: string | null) => void;
}) {
    const t = useTranslations('admin.courses');

    const { data, isLoading } = useQuery({
        queryKey: ['admin.groups.list', { page: 1, page_size: 200 }],
        queryFn: () => listGroups({ page: 1, page_size: 200 }),
        staleTime: 60_000,
    });

    const rows = data?.rows ?? [];

    return (
        <Select
            value={value ?? ''}
            onValueChange={(v) => onChange(v && v.length > 0 ? v : null)}
            disabled={isLoading}
        >
            <SelectTrigger className='w-72'>
                <SelectValue placeholder={t('select_a_group')} />
            </SelectTrigger>
            <SelectContent>
                {rows.length === 0 ? (
                    <div className='text-muted-foreground px-2 py-1.5 text-sm'>
                        {t('schedule_no_groups_for_teacher')}
                    </div>
                ) : (
                    rows.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                            {g.name}
                        </SelectItem>
                    ))
                )}
            </SelectContent>
        </Select>
    );
}
