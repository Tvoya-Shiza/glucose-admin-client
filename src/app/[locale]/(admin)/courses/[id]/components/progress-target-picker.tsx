'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { GroupPicker } from '@/components/groups/group-picker';
import { UserPicker } from '@/components/users/user-picker';

export interface ProgressTarget {
    kind: 'user' | 'group';
    target_id: number | null;
    label?: string | null;
}

export interface ProgressTargetPickerProps {
    value: ProgressTarget;
    onChange: (next: ProgressTarget) => void;
    disabled?: boolean;
}

/**
 * Phase 19 / Feature B — radio (user|group) + entity picker. Reused by both
 * the Progress-Manage tab (PR-6) and the Progress-View tab (PR-7).
 *
 * Changing the radio resets target_id to null so the parent sees the picker
 * as "not yet selected" and can decide whether to show downstream UI.
 */
export function ProgressTargetPicker({ value, onChange, disabled }: ProgressTargetPickerProps) {
    const t = useTranslations('admin.progress_overrides');
    const [userLabel, setUserLabel] = useState<string | null>(null);
    const [groupLabel, setGroupLabel] = useState<string | null>(null);

    return (
        <div className='space-y-3'>
            <div className='flex gap-4'>
                <label className='inline-flex cursor-pointer items-center gap-2 text-sm'>
                    <input
                        type='radio'
                        name='progress-target-kind'
                        value='user'
                        checked={value.kind === 'user'}
                        onChange={() => onChange({ kind: 'user', target_id: null })}
                        disabled={disabled}
                    />
                    {t('target_user')}
                </label>
                <label className='inline-flex cursor-pointer items-center gap-2 text-sm'>
                    <input
                        type='radio'
                        name='progress-target-kind'
                        value='group'
                        checked={value.kind === 'group'}
                        onChange={() => onChange({ kind: 'group', target_id: null })}
                        disabled={disabled}
                    />
                    {t('target_group')}
                </label>
            </div>

            {value.kind === 'user' ? (
                <UserPicker
                    roles={['student']}
                    value={value.target_id}
                    onChange={(id, row) => {
                        setUserLabel(row?.full_name ?? row?.email ?? null);
                        onChange({
                            kind: 'user',
                            target_id: id,
                            label: row?.full_name ?? row?.email ?? null,
                        });
                    }}
                    disabled={disabled}
                    placeholder={t('user_picker_placeholder')}
                    initialLabel={userLabel}
                />
            ) : (
                <GroupPicker
                    value={value.target_id}
                    onChange={(id, row) => {
                        setGroupLabel(row?.name ?? null);
                        onChange({ kind: 'group', target_id: id, label: row?.name ?? null });
                    }}
                    disabled={disabled}
                    placeholder={t('group_picker_placeholder')}
                    initialLabel={groupLabel}
                />
            )}
        </div>
    );
}
