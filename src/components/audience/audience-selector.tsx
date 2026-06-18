'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listAudienceRoles } from '@/lib/audience/api';
import type {
    AudienceFilter,
    AudienceKind,
    AudienceShape,
    CohortPredicate,
    RegionField,
} from '@/lib/audience/types';

interface Props {
    value: AudienceShape;
    onChange: (next: AudienceShape) => void;
}

/**
 * Phase 8 Plan 02 — AudienceSelector (D-01).
 *
 * Composes a list of filters (group | role | region | cohort) plus the three
 * exclude_* flags. Server resolves the filter into the user list at fire-time;
 * this component never sees user IDs (except in <AudiencePreview/> sample of 5).
 *
 * UX:
 *   [ Type dropdown ] [ + Add filter ]   <- choose kind, click to append
 *   [ filter row 1 ] [remove]
 *   [ filter row 2 ] [remove]
 *   [ exclude_no_fcm checkbox ]
 *   [ exclude_unsubscribed checkbox ]
 *
 * v1 limitations (documented for Plan 04+ polish):
 *   - Group + Region IDs are entered via comma-separated <Input>. Phase 4 ships
 *     a Group list page but no async <GroupPicker> component yet; Phase 9+ may
 *     add async <GroupPicker> + <RegionPicker> Comboboxes — swap them in here
 *     by replacing the two <Input> fields without touching wire contract.
 *   - exclude_no_email is push-irrelevant; the AudienceSelector exposes it for
 *     the mailings surface (Plan 05) — Plan 03 push-compose can hide via prop.
 *
 * The component is form-state agnostic — Plans 03/04/05 wire it inside
 * react-hook-form via <Controller> (D-20).
 */
export function AudienceSelector({ value, onChange }: Props) {
    const t = useTranslations('admin.audience');
    const [pendingKind, setPendingKind] = useState<AudienceKind>('role');

    function update(filters: AudienceFilter[], extra?: Partial<AudienceShape>) {
        onChange({ ...value, ...extra, filters });
    }

    function addFilter(kind: AudienceKind) {
        const newFilter: AudienceFilter =
            kind === 'group'
                ? { kind: 'group', group_ids: [] }
                : kind === 'role'
                  ? { kind: 'role', roles: [] }
                  : kind === 'region'
                    ? { kind: 'region', field: 'province_id', region_ids: [] }
                    : { kind: 'cohort', predicate: { type: 'inactive_days', days: 7 } };
        update([...value.filters, newFilter]);
    }

    function removeFilter(idx: number) {
        update(value.filters.filter((_, i) => i !== idx));
    }

    function patchFilter(idx: number, next: AudienceFilter) {
        update(value.filters.map((f, i) => (i === idx ? next : f)));
    }

    return (
        <div className='flex flex-col gap-4'>
            <div className='flex items-end gap-2'>
                <div className='flex-1'>
                    <Label>{t('kind_label')}</Label>
                    <Select value={pendingKind} onValueChange={(v) => setPendingKind(v as AudienceKind)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='group'>{t('kind_group')}</SelectItem>
                            <SelectItem value='role'>{t('kind_role')}</SelectItem>
                            <SelectItem value='region'>{t('kind_region')}</SelectItem>
                            <SelectItem value='cohort'>{t('kind_cohort')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button type='button' variant='outline' onClick={() => addFilter(pendingKind)}>
                    {t('add_filter')}
                </Button>
            </div>

            {value.filters.length === 0 && (
                <p className='text-sm text-muted-foreground'>{t('required_audience')}</p>
            )}

            {value.filters.map((filter, idx) => (
                <div key={idx} className='flex flex-col gap-2 rounded-md border p-3'>
                    <FilterRow filter={filter} onChange={(next) => patchFilter(idx, next)} />
                    <Button type='button' variant='ghost' size='sm' onClick={() => removeFilter(idx)}>
                        {t('remove_filter')}
                    </Button>
                </div>
            ))}

            {value.filters.length > 1 && (
                <p className='text-xs text-muted-foreground'>{t('filters_and_hint')}</p>
            )}

            <div className='flex flex-col gap-2'>
                <label className='flex items-center gap-2 text-sm'>
                    <Checkbox
                        checked={!!value.exclude_no_fcm}
                        onCheckedChange={(checked) => update(value.filters, { exclude_no_fcm: checked === true })}
                    />
                    {t('exclude_no_fcm')}
                </label>
                <label className='flex items-center gap-2 text-sm'>
                    <Checkbox
                        checked={!!value.exclude_unsubscribed}
                        onCheckedChange={(checked) =>
                            update(value.filters, { exclude_unsubscribed: checked === true })
                        }
                    />
                    {t('exclude_unsubscribed')}
                </label>
            </div>
        </div>
    );
}

function FilterRow({ filter, onChange }: { filter: AudienceFilter; onChange: (next: AudienceFilter) => void }) {
    const t = useTranslations('admin.audience');

    // Data-driven role list: real `role_name` values + counts from the DB. Fetched
    // only for role rows (enabled gate). Cached 5 min — the role set rarely changes.
    const rolesQuery = useQuery({
        queryKey: ['audience.roles'],
        queryFn: listAudienceRoles,
        staleTime: 5 * 60_000,
        enabled: filter.kind === 'role',
    });

    // Friendly label for known roles; unknown role_names fall back to the raw value.
    const roleLabel = (name: string): string => {
        switch (name) {
            case 'user':
                return t('role_user');
            case 'student':
                return t('role_student');
            case 'teacher':
                return t('role_teacher');
            case 'curator':
                return t('role_curator');
            case 'admin':
                return t('role_admin');
            default:
                return name;
        }
    };

    if (filter.kind === 'role') {
        const roles = filter.roles;
        const toggle = (r: string) => {
            const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];
            onChange({ kind: 'role', roles: next });
        };
        const available = rolesQuery.data ?? [];
        return (
            <div className='flex flex-col gap-1'>
                <Label>{t('role_picker_label')}</Label>
                {rolesQuery.isLoading ? (
                    <p className='text-sm text-muted-foreground'>{t('role_picker_loading')}</p>
                ) : (
                    <div className='flex flex-wrap gap-3'>
                        {available.map((r) => (
                            <label key={r.role_name} className='flex items-center gap-1 text-sm'>
                                <Checkbox
                                    checked={roles.includes(r.role_name)}
                                    onCheckedChange={() => toggle(r.role_name)}
                                />
                                <span>
                                    {roleLabel(r.role_name)}{' '}
                                    <span className='text-muted-foreground tabular-nums'>— {r.count}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (filter.kind === 'group') {
        return (
            <div className='flex flex-col gap-1'>
                <Label>{t('group_picker_label')}</Label>
                <Input
                    placeholder={t('group_picker_placeholder')}
                    value={filter.group_ids.join(',')}
                    onChange={(e) =>
                        onChange({
                            kind: 'group',
                            group_ids: parseIdList(e.target.value),
                        })
                    }
                />
            </div>
        );
    }

    if (filter.kind === 'region') {
        return (
            <div className='flex flex-col gap-2'>
                <div className='flex flex-col gap-1'>
                    <Label>{t('region_field_label')}</Label>
                    <Select
                        value={filter.field}
                        onValueChange={(v) =>
                            onChange({
                                kind: 'region',
                                field: v as RegionField,
                                region_ids: filter.region_ids,
                            })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='country_id'>{t('region_field_country')}</SelectItem>
                            <SelectItem value='province_id'>{t('region_field_province')}</SelectItem>
                            <SelectItem value='city_id'>{t('region_field_city')}</SelectItem>
                            <SelectItem value='district_id'>{t('region_field_district')}</SelectItem>
                            <SelectItem value='school_id'>{t('region_field_school')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className='flex flex-col gap-1'>
                    <Label>{t('region_picker_label')}</Label>
                    <Input
                        placeholder={t('region_picker_placeholder')}
                        value={filter.region_ids.join(',')}
                        onChange={(e) =>
                            onChange({
                                kind: 'region',
                                field: filter.field,
                                region_ids: parseIdList(e.target.value),
                            })
                        }
                    />
                </div>
            </div>
        );
    }

    // cohort
    const p: CohortPredicate = filter.predicate;
    return (
        <div className='flex flex-col gap-2'>
            <div className='flex flex-col gap-1'>
                <Label>{t('cohort_picker_label')}</Label>
                <Select
                    value={p.type}
                    onValueChange={(v) => {
                        const next: CohortPredicate =
                            v === 'completed_course'
                                ? { type: 'completed_course', webinar_id: 0 }
                                : v === 'inactive_days'
                                  ? { type: 'inactive_days', days: 7 }
                                  : { type: 'status', status: 'active' };
                        onChange({ kind: 'cohort', predicate: next });
                    }}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='completed_course'>{t('cohort_completed_course')}</SelectItem>
                        <SelectItem value='inactive_days'>{t('cohort_inactive_days')}</SelectItem>
                        <SelectItem value='status'>{t('cohort_status')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {p.type === 'completed_course' && (
                <div className='flex flex-col gap-1'>
                    <Label>{t('cohort_completed_course_select')}</Label>
                    <Input
                        type='number'
                        min={1}
                        placeholder={t('cohort_completed_course_select')}
                        value={p.webinar_id || ''}
                        onChange={(e) =>
                            onChange({
                                kind: 'cohort',
                                predicate: { type: 'completed_course', webinar_id: parseInt(e.target.value, 10) || 0 },
                            })
                        }
                    />
                </div>
            )}

            {p.type === 'inactive_days' && (
                <div className='flex flex-col gap-1'>
                    <Label>{t('cohort_inactive_days_label')}</Label>
                    <Input
                        type='number'
                        min={1}
                        value={p.days}
                        onChange={(e) =>
                            onChange({
                                kind: 'cohort',
                                predicate: { type: 'inactive_days', days: parseInt(e.target.value, 10) || 1 },
                            })
                        }
                    />
                </div>
            )}

            {p.type === 'status' && (
                <div className='flex flex-col gap-1'>
                    <Label>{t('cohort_status')}</Label>
                    <Select
                        value={p.status}
                        onValueChange={(v) =>
                            onChange({
                                kind: 'cohort',
                                predicate: { type: 'status', status: v as 'active' | 'pending' | 'inactive' },
                            })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='active'>{t('cohort_status_active')}</SelectItem>
                            <SelectItem value='pending'>{t('cohort_status_pending')}</SelectItem>
                            <SelectItem value='inactive'>{t('cohort_status_inactive')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}

/** Parse a comma-separated list of positive integers; ignore garbage entries. */
function parseIdList(raw: string): number[] {
    return raw
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
}
