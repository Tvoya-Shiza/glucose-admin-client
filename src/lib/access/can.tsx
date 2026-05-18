'use client';

import type { ReactNode } from 'react';
import { useCanAll, useCanAny, usePermission } from './use-permission';
import type { PermissionCode } from './permission-codes';

interface CanPropsSingle {
    permission: PermissionCode | string;
    anyOf?: never;
    allOf?: never;
    fallback?: ReactNode;
    children: ReactNode;
}

interface CanPropsAny {
    permission?: never;
    anyOf: ReadonlyArray<PermissionCode | string>;
    allOf?: never;
    fallback?: ReactNode;
    children: ReactNode;
}

interface CanPropsAll {
    permission?: never;
    anyOf?: never;
    allOf: ReadonlyArray<PermissionCode | string>;
    fallback?: ReactNode;
    children: ReactNode;
}

type CanProps = CanPropsSingle | CanPropsAny | CanPropsAll;

/**
 * Declarative permission gate.
 *
 *   <Can permission="users.create"><Button>...</Button></Can>
 *   <Can anyOf={['users.edit', 'users.delete']}>...</Can>
 *   <Can allOf={['users.edit', 'users.export']} fallback={<Disabled />}>...</Can>
 *
 * Admin (is_super) always sees the children. During the initial /api/auth/me load,
 * the gate hides children (matches usePermission's deny-during-load posture).
 */
export function Can(props: CanProps): ReactNode {
    const { fallback = null, children } = props;
    const single = usePermission((props as CanPropsSingle).permission ?? '');
    const any = useCanAny((props as CanPropsAny).anyOf ?? []);
    const all = useCanAll((props as CanPropsAll).allOf ?? []);

    if ('permission' in props && props.permission) {
        return single ? <>{children}</> : <>{fallback}</>;
    }
    if ('anyOf' in props && props.anyOf) {
        return any ? <>{children}</> : <>{fallback}</>;
    }
    if ('allOf' in props && props.allOf) {
        return all ? <>{children}</> : <>{fallback}</>;
    }
    return <>{fallback}</>;
}
