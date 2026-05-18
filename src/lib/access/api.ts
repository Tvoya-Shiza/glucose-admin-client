'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { ME_QUERY_KEY } from './use-me';

export interface RoleSummary {
    id: number;
    code: string;
    name: string;
    description: string | null;
    is_admin: boolean;
    is_system: boolean;
    display_order: number;
    user_count: number;
    permission_count: number | null;
}

export interface PermissionItem {
    id: number;
    code: string;
    action: string;
    name_ru: string;
    name_kz: string;
    description: string | null;
    display_order: number;
}

export interface PermissionGroupItem {
    id: number;
    code: string;
    name_ru: string;
    name_kz: string;
    display_order: number;
    permissions: PermissionItem[];
}

interface Envelope<T> {
    success: boolean;
    status?: string;
    message?: string;
    data?: T;
}

async function getJson<T>(path: string): Promise<T> {
    const res = await fetchWithRefresh(path);
    const env = (await res.json()) as Envelope<T>;
    if (!res.ok || !env.success || env.data === undefined) {
        const reason = env.status ?? `http_${res.status}`;
        throw new Error(reason);
    }
    return env.data;
}

async function sendJson<T>(
    path: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: unknown,
): Promise<T> {
    const res = await fetchWithRefresh(path, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const env = (await res.json()) as Envelope<T>;
    if (!res.ok || !env.success) {
        const reason = env.status ?? `http_${res.status}`;
        throw new Error(reason);
    }
    return (env.data ?? (undefined as unknown)) as T;
}

const ROLES_BASE = '/api/proxy/v1/admin/access';

export const ACCESS_QUERY_KEYS = {
    roles: () => ['access', 'roles'] as const,
    rolePermissions: (id: number) => ['access', 'roles', id, 'permissions'] as const,
    catalog: () => ['access', 'permissions'] as const,
};

export function useRolesList() {
    return useQuery({
        queryKey: ACCESS_QUERY_KEYS.roles(),
        queryFn: () => getJson<{ roles: RoleSummary[] }>(`${ROLES_BASE}/roles`).then((d) => d.roles),
    });
}

export function usePermissionsCatalog() {
    return useQuery({
        queryKey: ACCESS_QUERY_KEYS.catalog(),
        queryFn: () =>
            getJson<{ groups: PermissionGroupItem[] }>(`${ROLES_BASE}/permissions`).then((d) => d.groups),
        staleTime: 60 * 60 * 1000, // catalog rarely changes; refetch on focus suffices
    });
}

export function useRolePermissions(roleId: number, enabled = true) {
    return useQuery({
        queryKey: ACCESS_QUERY_KEYS.rolePermissions(roleId),
        queryFn: () =>
            getJson<{ codes: string[] }>(`${ROLES_BASE}/roles/${roleId}/permissions`).then((d) => d.codes),
        enabled,
    });
}

export function useCreateRole() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: { code: string; name: string; description?: string }) =>
            sendJson<{ role: RoleSummary }>(`${ROLES_BASE}/roles`, 'POST', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ACCESS_QUERY_KEYS.roles() });
        },
    });
}

export function useUpdateRole(roleId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: { name?: string; description?: string }) =>
            sendJson<{ role: RoleSummary }>(`${ROLES_BASE}/roles/${roleId}`, 'PATCH', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ACCESS_QUERY_KEYS.roles() });
        },
    });
}

export function useDeleteRole() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (roleId: number) => sendJson<void>(`${ROLES_BASE}/roles/${roleId}`, 'DELETE'),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ACCESS_QUERY_KEYS.roles() });
        },
    });
}

export function useSetRolePermissions(roleId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (codes: string[]) =>
            sendJson<{ codes: string[] }>(`${ROLES_BASE}/roles/${roleId}/permissions`, 'PUT', { codes }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ACCESS_QUERY_KEYS.rolePermissions(roleId) });
            qc.invalidateQueries({ queryKey: ACCESS_QUERY_KEYS.roles() });
            // If the current admin edited their own role, refresh /me so the
            // navigation and gates pick up the new permission set immediately.
            qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
        },
    });
}
