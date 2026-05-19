'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { getUser } from '@/lib/users/api';
import type { AssigneeType } from '@/lib/boards/types';

interface RoleRow {
    id: number;
    name: string;
    code: string;
}
interface GroupRow {
    id: number;
    name: string;
}

const ROLES_KEY = ['admin.boards.picker.roles'] as const;
const GROUPS_KEY = ['admin.boards.picker.groups'] as const;

/**
 * Resolves a single polymorphic assignee row → human display name.
 *
 *   user      → users.id  → "Иван Иванов"   (per-id useQuery, 5-minute cache)
 *   role      → roles.id  → "Куратор"        (single shared list query)
 *   group     → groups.id → "Группа A"       (single shared list query)
 *   everyone  →           → "Все сотрудники" (synchronous)
 *
 * TanStack Query dedupes identical queryKeys, so 5 user-chips with the same
 * user_id only fire one network call.
 */
export function useAssigneeName(type: AssigneeType, id: number | null): { label: string; isLoading: boolean } {
    const userQuery = useQuery({
        queryKey: ['admin.boards.assignee.user', id],
        queryFn: () => getUser(id!),
        enabled: type === 'user' && id !== null,
        staleTime: 5 * 60_000,
    });

    const rolesQuery = useQuery({
        queryKey: ROLES_KEY,
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/proxy/v1/admin/access/roles');
            if (!res.ok) throw new Error('roles_failed');
            const json = await res.json();
            const payload = json?.data ?? json;
            return { rows: (payload.roles ?? payload.rows ?? []) as RoleRow[] };
        },
        enabled: type === 'role',
        staleTime: 10 * 60_000,
    });

    const groupsQuery = useQuery({
        queryKey: GROUPS_KEY,
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/proxy/v1/admin/groups?page_size=200');
            if (!res.ok) throw new Error('groups_failed');
            const json = await res.json();
            const payload = json?.data ?? json;
            return { rows: (payload.rows ?? []) as GroupRow[] };
        },
        enabled: type === 'group',
        staleTime: 10 * 60_000,
    });

    if (type === 'everyone') return { label: 'Все сотрудники', isLoading: false };

    if (type === 'user') {
        const u = userQuery.data;
        return {
            label: u ? (u.full_name || u.email || `#${id}`) : `#${id}`,
            isLoading: userQuery.isLoading,
        };
    }

    if (type === 'role') {
        const r = rolesQuery.data?.rows.find((x) => x.id === id);
        return { label: r?.name ?? `#${id}`, isLoading: rolesQuery.isLoading };
    }

    if (type === 'group') {
        const g = groupsQuery.data?.rows.find((x) => x.id === id);
        return { label: g?.name ?? `#${id}`, isLoading: groupsQuery.isLoading };
    }

    return { label: '—', isLoading: false };
}
