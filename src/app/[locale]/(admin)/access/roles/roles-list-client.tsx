'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Can } from '@/lib/access/can';
import { useMe } from '@/lib/access/use-me';
import { useRolesList, type RoleSummary } from '@/lib/access/api';
import { CreateRoleDialog } from './create-role-dialog';
import { DeleteRoleDialog } from './delete-role-dialog';
import { RoleMatrixDrawer } from './role-matrix-drawer';

export function RolesListClient() {
    const t = useTranslations('admin.access');
    const { data: me, isPending: mePending, error: meError } = useMe();
    const { data: roles, isLoading, error } = useRolesList();

    const [createOpen, setCreateOpen] = useState(false);
    const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
    const [deletingRole, setDeletingRole] = useState<RoleSummary | null>(null);

    // SSR + first client paint hit this branch (no data, no error yet). Without
    // isPending the page would flash the "no access" state because useQuery's
    // default state is { data: undefined, isLoading: false, error: null }.
    if (mePending || !me) {
        return (
            <PageShell header={<PageHeader title={t('title')} subtitle={t('subtitle')} />}>
                <Card className='p-6 text-sm text-muted-foreground'>{t('loading')}</Card>
            </PageShell>
        );
    }
    if (meError) {
        return (
            <PageShell header={<PageHeader title={t('title')} subtitle={t('subtitle')} />}>
                <EmptyState
                    icon={ShieldCheck}
                    title={t('no_access_title')}
                    subtitle={(meError as Error).message}
                />
            </PageShell>
        );
    }

    // Route-level <PermissionGate> in (admin)/layout.tsx guarantees access.manage
    // before this component renders; no per-component check needed.

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('title')}
                    subtitle={t('subtitle')}
                    actions={
                        <Can permission='access.manage'>
                            <Button onClick={() => setCreateOpen(true)}>
                                <Plus className='mr-2 h-4 w-4' />
                                {t('create_role')}
                            </Button>
                        </Can>
                    }
                />
            }
        >
            <Card className='overflow-hidden'>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className='w-[28%]'>{t('table.name')}</TableHead>
                            <TableHead className='w-[16%]'>{t('table.code')}</TableHead>
                            <TableHead className='w-[18%]'>{t('table.users')}</TableHead>
                            <TableHead className='w-[18%]'>{t('table.permissions')}</TableHead>
                            <TableHead className='w-[10%]'>{t('table.type')}</TableHead>
                            <TableHead className='w-[10%] text-right'>{t('table.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className='text-center text-muted-foreground'>
                                    {t('loading')}
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={6} className='text-center text-destructive'>
                                    {(error as Error).message}
                                </TableCell>
                            </TableRow>
                        ) : !roles || roles.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6}>
                                    <EmptyState
                                        icon={ShieldCheck}
                                        title={t('empty_title')}
                                        subtitle={t('empty_body')}
                                    />
                                </TableCell>
                            </TableRow>
                        ) : (
                            roles.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell>
                                        <div className='flex flex-col'>
                                            <span className='font-medium'>{r.name}</span>
                                            {r.description ? (
                                                <span className='text-xs text-muted-foreground'>{r.description}</span>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>{r.code}</code>
                                    </TableCell>
                                    <TableCell>
                                        <span className='flex items-center gap-1.5 text-sm'>
                                            <UsersIcon className='h-3.5 w-3.5 text-muted-foreground' />
                                            {r.user_count}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {r.permission_count === null ? (
                                            <Badge variant='secondary'>{t('super_badge')}</Badge>
                                        ) : (
                                            <span className='text-sm'>{r.permission_count}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {r.is_system ? (
                                            <Badge variant='outline'>{t('system_badge')}</Badge>
                                        ) : (
                                            <Badge variant='secondary'>{t('custom_badge')}</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className='text-right'>
                                        <div className='flex justify-end gap-1.5'>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                onClick={() => setEditingRoleId(r.id)}
                                            >
                                                {t('table.open')}
                                            </Button>
                                            {!r.is_system && r.user_count === 0 ? (
                                                <Button
                                                    size='sm'
                                                    variant='ghost'
                                                    className='text-destructive hover:bg-destructive/10 hover:text-destructive'
                                                    onClick={() => setDeletingRole(r)}
                                                >
                                                    {t('table.delete')}
                                                </Button>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            <CreateRoleDialog open={createOpen} onOpenChange={setCreateOpen} />
            {editingRoleId !== null ? (
                <RoleMatrixDrawer
                    roleId={editingRoleId}
                    open={editingRoleId !== null}
                    onOpenChange={(o) => !o && setEditingRoleId(null)}
                />
            ) : null}
            {deletingRole ? (
                <DeleteRoleDialog
                    role={deletingRole}
                    open={deletingRole !== null}
                    onOpenChange={(o) => !o && setDeletingRole(null)}
                />
            ) : null}
        </PageShell>
    );
}
