'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { listUsers } from '@/lib/users/api';
import type { AssigneeType } from '@/lib/boards/types';

/**
 * Inline picker that adds one assignee at a time. Four sub-pickers:
 *   - user  — search-by-name with a debounced /users list call
 *   - role  — fetched from /access/roles
 *   - group — fetched from /groups
 *   - everyone — single click
 *
 * The parent (TaskDetailDialog) maintains the assignee array; this picker is
 * stateless past the dropdown open state + sub-mode.
 */

interface AssigneePick {
    assignee_type: AssigneeType;
    assignee_id: number | null;
}

interface Role {
    id: number;
    name: string;
    code: string;
}
interface Group {
    id: number;
    name: string;
}

export function AssigneePicker({ onPick }: { onPick: (pick: AssigneePick) => void }) {
    const t = useTranslations('admin.boards.task');
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'menu' | 'user' | 'role' | 'group'>('menu');

    const close = () => {
        setOpen(false);
        setMode('menu');
    };

    return (
        <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (!o) setMode('menu'); }}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="mt-2 gap-2">
                    <Plus className="h-3.5 w-3.5" /> <UsersIcon className="h-3.5 w-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72" align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                {mode === 'menu' && (
                    <>
                        <DropdownMenuLabel>{t('assignees_label')}</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMode('user'); }}>
                            {t('assignee_add_user')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMode('role'); }}>
                            {t('assignee_add_role')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMode('group'); }}>
                            {t('assignee_add_group')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={() => {
                                onPick({ assignee_type: 'everyone', assignee_id: null });
                                close();
                            }}
                        >
                            {t('assignee_add_everyone')}
                        </DropdownMenuItem>
                    </>
                )}
                {mode === 'user' && (
                    <UserSubPicker
                        onPick={(id) => {
                            onPick({ assignee_type: 'user', assignee_id: id });
                            close();
                        }}
                    />
                )}
                {mode === 'role' && (
                    <RoleSubPicker
                        onPick={(id) => {
                            onPick({ assignee_type: 'role', assignee_id: id });
                            close();
                        }}
                    />
                )}
                {mode === 'group' && (
                    <GroupSubPicker
                        onPick={(id) => {
                            onPick({ assignee_type: 'group', assignee_id: id });
                            close();
                        }}
                    />
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function UserSubPicker({ onPick }: { onPick: (id: number) => void }) {
    const [q, setQ] = useState('');
    const query = useQuery({
        queryKey: ['admin.boards.picker.users', q],
        queryFn: () => listUsers({ q: q || undefined, page_size: 10 }),
        staleTime: 5_000,
    });
    return (
        <div className="p-2">
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="mb-2" />
            <div className="max-h-60 overflow-y-auto">
                {query.data?.rows.map((u) => (
                    <button
                        key={u.id}
                        onClick={() => onPick(u.id)}
                        className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
                    >
                        {u.full_name ?? u.email ?? `#${u.id}`}
                    </button>
                ))}
            </div>
        </div>
    );
}

function RoleSubPicker({ onPick }: { onPick: (id: number) => void }) {
    const query = useQuery({
        queryKey: ['admin.boards.picker.roles'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/proxy/v1/admin/access/roles');
            if (!res.ok) throw new Error('roles_failed');
            const json = await res.json();
            // admin-api wraps in apiResponse: { data: { roles: [...] } }
            const payload = json?.data ?? json;
            return { rows: (payload.roles ?? payload.rows ?? []) as Role[] };
        },
    });
    return (
        <div className="max-h-60 overflow-y-auto p-2">
            {query.isLoading && <p className="px-2 py-1 text-xs text-muted-foreground">…</p>}
            {!query.isLoading && (query.data?.rows.length ?? 0) === 0 && (
                <p className="px-2 py-1 text-xs italic text-muted-foreground">Нет ролей</p>
            )}
            {(query.data?.rows ?? []).map((r) => (
                <button
                    key={r.id}
                    onClick={() => onPick(r.id)}
                    className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
                >
                    {r.name}
                </button>
            ))}
        </div>
    );
}

function GroupSubPicker({ onPick }: { onPick: (id: number) => void }) {
    const query = useQuery({
        queryKey: ['admin.boards.picker.groups'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/proxy/v1/admin/groups?page_size=200');
            if (!res.ok) throw new Error('groups_failed');
            const json = await res.json();
            const payload = json?.data ?? json;
            return { rows: (payload.rows ?? []) as Group[] };
        },
    });
    return (
        <div className="max-h-60 overflow-y-auto p-2">
            {query.isLoading && <p className="px-2 py-1 text-xs text-muted-foreground">…</p>}
            {!query.isLoading && (query.data?.rows.length ?? 0) === 0 && (
                <p className="px-2 py-1 text-xs italic text-muted-foreground">Нет групп</p>
            )}
            {(query.data?.rows ?? []).map((g) => (
                <button
                    key={g.id}
                    onClick={() => onPick(g.id)}
                    className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
                >
                    {g.name}
                </button>
            ))}
        </div>
    );
}
