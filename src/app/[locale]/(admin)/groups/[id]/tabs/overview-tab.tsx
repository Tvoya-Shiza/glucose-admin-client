'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statusBadgeVariant } from '@/lib/groups/format';
import type { GroupDetail } from '@/lib/groups/types';
import { EditGroupForm } from '../components/edit-group-form';
import { SupervisorChangeDialog } from '../components/supervisor-change-dialog';

export interface OverviewTabProps {
    group: GroupDetail;
    role: 'admin' | 'curator' | 'teacher';
}

/**
 * GRP-06 + GRP-02 — Group detail Overview tab.
 *
 * Read-only field grid (Name | Status | Supervisor | Creator | Member count) with
 * admin-only Edit / Change Supervisor buttons. Mirrors Phase 3 ProfileTab edit-in-place
 * pattern: clicking Edit toggles to <EditGroupForm>; Cancel returns to read-only view.
 *
 * Curator sees no buttons (read-only view of their own group). Teacher won't reach this
 * tab because admin-api detail endpoint 403s them (GRP-05 default-deny).
 *
 * Delete button lives in the page header (group-detail-client.tsx), not in this tab —
 * mirrors the Phase 3 layout (destructive action separated from per-section edits).
 */
export function OverviewTab({ group, role }: OverviewTabProps) {
    const t = useTranslations('admin.groups');
    const [editing, setEditing] = useState(false);
    const [supervisorOpen, setSupervisorOpen] = useState(false);

    const isAdmin = role === 'admin';

    if (editing && isAdmin) {
        return (
            <EditGroupForm
                group={group}
                onCancel={() => setEditing(false)}
                onSaved={() => setEditing(false)}
            />
        );
    }

    return (
        <div className='space-y-3 pt-4'>
            <Field label={t('col_name')} value={group.name} />
            <FieldNode label={t('col_status')}>
                <Badge variant={statusBadgeVariant(group.status)}>
                    {group.status === 'active' ? t('status_active') : t('status_inactive')}
                </Badge>
            </FieldNode>
            <Field
                label={t('col_supervisor')}
                value={
                    group.supervisor
                        ? `${group.supervisor.full_name ?? `user#${group.supervisor.id}`} (id ${group.supervisor.id})`
                        : t('supervisor_unassigned')
                }
            />
            <Field
                label='Creator'
                value={
                    group.creator
                        ? `${group.creator.full_name ?? `user#${group.creator.id}`} (id ${group.creator.id})`
                        : '—'
                }
            />
            <Field label={t('col_members')} value={String(group.member_count)} />

            {isAdmin ? (
                <div className='flex gap-2 pt-2'>
                    <Button onClick={() => setEditing(true)}>{t('edit')}</Button>
                    <Button variant='outline' onClick={() => setSupervisorOpen(true)}>
                        {t('change_supervisor')}
                    </Button>
                </div>
            ) : null}

            {isAdmin ? (
                <SupervisorChangeDialog
                    open={supervisorOpen}
                    onOpenChange={setSupervisorOpen}
                    group={group}
                />
            ) : null}
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className='grid grid-cols-3 gap-2 text-sm'>
            <div className='text-muted-foreground'>{label}</div>
            <div className='col-span-2'>{value}</div>
        </div>
    );
}

function FieldNode({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='grid grid-cols-3 gap-2 text-sm'>
            <div className='text-muted-foreground'>{label}</div>
            <div className='col-span-2'>{children}</div>
        </div>
    );
}
