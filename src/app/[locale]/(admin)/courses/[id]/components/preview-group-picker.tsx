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
 * PreviewGroupPicker — Plan 07 (CRS-09).
 *
 * Variant of Plan 06's GroupContextPicker with one extra option: "(no group context)"
 * mapped to a sentinel value that the parent translates to `groupId === null`. This
 * gives the admin a "see-everything" mode in the preview tab — equivalent to the
 * preview endpoint being called without ?group_id (server returns visible_now=true
 * for every item).
 *
 * NOTE on extraction: this picker and Plan 06's GroupContextPicker share most of
 * their structure. We chose to copy rather than extract a shared component because
 * the "no-group" option changes the value semantics (Plan 06 has no concept of
 * "no group" — its tab requires a group selection to render anything). A shared
 * component would either require a feature flag or fork the rendering inside;
 * keeping two thin pickers is the simpler trade-off. Future polish: extract once
 * a third call-site appears.
 *
 * Sentinel: empty string in the Select component value means "no group context".
 * The shadcn Select forbids empty SelectItem `value`, so we use a non-empty
 * sentinel ("__none__") for the option and map it to null in onChange.
 */
const NO_GROUP_SENTINEL = '__none__';

export function PreviewGroupPicker({
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
            value={value ?? NO_GROUP_SENTINEL}
            onValueChange={(v) => onChange(v === NO_GROUP_SENTINEL ? null : v)}
            disabled={isLoading}
        >
            <SelectTrigger className='w-72'>
                <SelectValue placeholder={t('select_a_group')} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NO_GROUP_SENTINEL}>
                    {t('no_group_selected_preview_admin_view')}
                </SelectItem>
                {rows.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
