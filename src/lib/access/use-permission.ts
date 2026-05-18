'use client';

import { useMemo } from 'react';
import { useMe } from './use-me';
import type { PermissionCode } from './permission-codes';

/**
 * Returns true if the current user has the given permission.
 *
 * Behavior:
 *   - Admin (role_name='admin' OR is_super) → always true. The role_name fallback
 *     handles older /auth/me responses that haven't been redeployed with the
 *     is_super + permissions[] fields yet.
 *   - Loading (no `me` yet) → false (DENY-DURING-LOAD).
 *     Prevents SSR/CSR hydration mismatch without requiring a `mounted` workaround.
 *   - Otherwise → membership check in `permissions[]`.
 *
 * Defensive against partially-populated /me responses: `permissions` is treated
 * as an empty array if undefined (old backend versions, network race, etc.).
 */
function isAdminLike(data: { is_super?: boolean; role_name?: string } | undefined): boolean {
    return Boolean(data?.is_super) || data?.role_name === 'admin';
}

export function usePermission(code: PermissionCode | string): boolean {
    const { data } = useMe();
    return useMemo(() => {
        if (!data) return false;
        if (isAdminLike(data)) return true;
        return (data.permissions ?? []).includes(code);
    }, [data, code]);
}

export function useCanAny(codes: ReadonlyArray<PermissionCode | string>): boolean {
    const { data } = useMe();
    return useMemo(() => {
        if (!data) return false;
        if (isAdminLike(data)) return true;
        const perms = data.permissions ?? [];
        return codes.some((c) => perms.includes(c));
    }, [data, codes]);
}

export function useCanAll(codes: ReadonlyArray<PermissionCode | string>): boolean {
    const { data } = useMe();
    return useMemo(() => {
        if (!data) return false;
        if (isAdminLike(data)) return true;
        const perms = data.permissions ?? [];
        return codes.every((c) => perms.includes(c));
    }, [data, codes]);
}

export function usePermissions(): Set<string> {
    const { data } = useMe();
    return useMemo(() => new Set(data?.permissions ?? []), [data]);
}

export function useIsSuper(): boolean {
    const { data } = useMe();
    return isAdminLike(data);
}
