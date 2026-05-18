'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useRolePermissions,
    usePermissionsCatalog,
    useRolesList,
    useSetRolePermissions,
    type PermissionGroupItem,
    type PermissionItem,
} from '@/lib/access/api';
import { toast } from 'sonner';

interface Props {
    roleId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Fixed action ordering for matrix columns. Composite actions (anything not in this
// list) fall through to the "extra permissions" section below the matrix.
const COLUMN_ACTIONS = ['view', 'create', 'edit', 'delete', 'publish', 'import', 'export', 'impersonate', 'manage'] as const;
type ColumnAction = (typeof COLUMN_ACTIONS)[number];

function isColumnAction(action: string): action is ColumnAction {
    return (COLUMN_ACTIONS as readonly string[]).includes(action);
}

interface MatrixCell {
    permission: PermissionItem | null;
}

function buildMatrix(groups: PermissionGroupItem[]): {
    rows: { group: PermissionGroupItem; cells: Record<ColumnAction, MatrixCell> }[];
    extras: { group: PermissionGroupItem; permissions: PermissionItem[] }[];
    columnsInUse: ColumnAction[];
} {
    const columnsUsed = new Set<ColumnAction>();
    const rows = groups.map((g) => {
        const cells = Object.fromEntries(
            COLUMN_ACTIONS.map((a) => [a, { permission: null } as MatrixCell]),
        ) as Record<ColumnAction, MatrixCell>;
        for (const p of g.permissions) {
            if (isColumnAction(p.action)) {
                cells[p.action] = { permission: p };
                columnsUsed.add(p.action);
            }
        }
        return { group: g, cells };
    });
    const extras = groups
        .map((g) => ({
            group: g,
            permissions: g.permissions.filter((p) => !isColumnAction(p.action)),
        }))
        .filter((e) => e.permissions.length > 0);

    const columnsInUse = COLUMN_ACTIONS.filter((c) => columnsUsed.has(c));
    return { rows, extras, columnsInUse };
}

export function RoleMatrixDrawer({ roleId, open, onOpenChange }: Props) {
    const t = useTranslations('admin.access');
    const locale = useLocale();
    const isKz = locale === 'kz';

    const { data: roles } = useRolesList();
    const role = roles?.find((r) => r.id === roleId);
    const isAdminRole = role?.code === 'admin';

    const { data: catalog, isLoading: catalogLoading } = usePermissionsCatalog();
    const { data: granted, isLoading: grantedLoading } = useRolePermissions(roleId, open);
    const save = useSetRolePermissions(roleId);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [initial, setInitial] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (granted) {
            const set = new Set(granted);
            setSelected(set);
            setInitial(new Set(granted));
        }
    }, [granted]);

    const { rows, extras, columnsInUse } = useMemo(() => {
        if (!catalog) return { rows: [], extras: [], columnsInUse: [] };
        return buildMatrix(catalog);
    }, [catalog]);

    const hasDiff = useMemo(() => {
        if (selected.size !== initial.size) return true;
        for (const code of selected) if (!initial.has(code)) return true;
        return false;
    }, [selected, initial]);

    function toggle(code: string) {
        if (isAdminRole) return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    }

    function toggleAllInRow(group: PermissionGroupItem) {
        if (isAdminRole) return;
        setSelected((prev) => {
            const next = new Set(prev);
            const codes = group.permissions.map((p) => p.code);
            const allOn = codes.every((c) => next.has(c));
            for (const c of codes) {
                if (allOn) next.delete(c);
                else next.add(c);
            }
            return next;
        });
    }

    function toggleAllInColumn(action: ColumnAction) {
        if (isAdminRole) return;
        if (!catalog) return;
        setSelected((prev) => {
            const next = new Set(prev);
            const codes = catalog
                .flatMap((g) => g.permissions)
                .filter((p) => p.action === action)
                .map((p) => p.code);
            const allOn = codes.every((c) => next.has(c));
            for (const c of codes) {
                if (allOn) next.delete(c);
                else next.add(c);
            }
            return next;
        });
    }

    function clearAll() {
        if (isAdminRole) return;
        setSelected(new Set());
    }

    async function onSave() {
        try {
            await save.mutateAsync(Array.from(selected));
            toast.success(t('save_success'));
            setInitial(new Set(selected));
        } catch (err) {
            const msg = (err as Error).message;
            if (msg === 'cannot_modify_admin_permissions') {
                toast.error(t('cannot_modify_admin'));
            } else {
                toast.error(msg);
            }
        }
    }

    const loading = catalogLoading || grantedLoading;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side='right' className='w-full sm:max-w-3xl overflow-y-auto'>
                <SheetHeader className='border-b'>
                    <SheetTitle className='flex items-center gap-2'>
                        <ShieldCheck className='h-5 w-5 text-primary' />
                        {role?.name ?? t('loading')}
                        <code className='ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-mono'>
                            {role?.code}
                        </code>
                    </SheetTitle>
                    <SheetDescription>{role?.description ?? t('subtitle')}</SheetDescription>
                </SheetHeader>

                <div className='px-4 py-4 space-y-4'>
                    {isAdminRole ? (
                        <div className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'>
                            {t('admin_readonly_notice')}
                        </div>
                    ) : null}

                    {loading ? (
                        <div className='space-y-2'>
                            <Skeleton className='h-8 w-full' />
                            <Skeleton className='h-8 w-full' />
                            <Skeleton className='h-8 w-full' />
                        </div>
                    ) : (
                        <>
                            <div className='flex items-center justify-between'>
                                <h3 className='text-sm font-semibold'>{t('matrix_section')}</h3>
                                <Button size='sm' variant='ghost' onClick={clearAll} disabled={isAdminRole}>
                                    {t('clear_all')}
                                </Button>
                            </div>
                            <div className='overflow-x-auto rounded-md border'>
                                <table className='w-full border-collapse text-sm'>
                                    <thead>
                                        <tr className='border-b bg-muted/40'>
                                            <th className='px-3 py-2 text-left font-medium'>{t('matrix_section_col')}</th>
                                            {columnsInUse.map((a) => (
                                                <th key={a} className='px-2 py-2 text-center font-medium'>
                                                    <button
                                                        type='button'
                                                        className='hover:underline disabled:cursor-default disabled:no-underline'
                                                        onClick={() => toggleAllInColumn(a)}
                                                        disabled={isAdminRole}
                                                        title={t('toggle_column')}
                                                    >
                                                        {t(`action.${a}`)}
                                                    </button>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map(({ group, cells }) => (
                                            <tr key={group.id} className='border-b last:border-b-0'>
                                                <td className='px-3 py-2'>
                                                    <button
                                                        type='button'
                                                        className='font-medium hover:underline disabled:cursor-default disabled:no-underline'
                                                        onClick={() => toggleAllInRow(group)}
                                                        disabled={isAdminRole}
                                                        title={t('toggle_row')}
                                                    >
                                                        {isKz ? group.name_kz : group.name_ru}
                                                    </button>
                                                </td>
                                                {columnsInUse.map((a) => {
                                                    const cell = cells[a];
                                                    if (!cell.permission) {
                                                        return (
                                                            <td key={a} className='px-2 py-2 text-center text-muted-foreground/50'>
                                                                —
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <td key={a} className='px-2 py-2 text-center'>
                                                            <Checkbox
                                                                checked={isAdminRole || selected.has(cell.permission.code)}
                                                                onCheckedChange={() => toggle(cell.permission!.code)}
                                                                disabled={isAdminRole}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {extras.length > 0 ? (
                                <div className='space-y-2 pt-2'>
                                    <h3 className='text-sm font-semibold'>{t('extra_section')}</h3>
                                    <div className='rounded-md border divide-y'>
                                        {extras.map((e) => (
                                            <div key={e.group.id} className='p-3 space-y-2'>
                                                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                                                    {isKz ? e.group.name_kz : e.group.name_ru}
                                                </p>
                                                <ul className='space-y-1.5'>
                                                    {e.permissions.map((p) => (
                                                        <li key={p.id} className='flex items-center gap-2'>
                                                            <Checkbox
                                                                checked={isAdminRole || selected.has(p.code)}
                                                                onCheckedChange={() => toggle(p.code)}
                                                                disabled={isAdminRole}
                                                                id={`extra-${p.id}`}
                                                            />
                                                            <label
                                                                htmlFor={`extra-${p.id}`}
                                                                className='text-sm cursor-pointer'
                                                            >
                                                                {isKz ? p.name_kz : p.name_ru}
                                                            </label>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>

                <div className='sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background px-4 py-3'>
                    <Button variant='outline' onClick={() => onOpenChange(false)} disabled={save.isPending}>
                        {t('close')}
                    </Button>
                    <Button onClick={onSave} disabled={!hasDiff || isAdminRole || save.isPending}>
                        {save.isPending ? t('saving') : t('save')}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
