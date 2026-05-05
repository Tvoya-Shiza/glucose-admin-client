'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { listAudit } from '@/lib/audit/api';
import type { AuditListResponse } from '@/lib/audit/types';

interface AuditLogTabProps {
    /**
     * AdminAuditLog.entity (e.g. 'user', 'group', 'course', 'quiz', 'story', 'banner',
     * 'blog', 'promocode', 'sale').
     */
    entity: string;
    /**
     * AdminAuditLog.entity_id — string at the wire boundary (DB column is VARCHAR(64)).
     * Caller passes either a primitive id (number/string); the component coerces with
     * String(...) so callers don't need to remember the cast.
     */
    entityId: number | string;
    /**
     * Optional default page size (caller can override). Server caps at 200.
     */
    pageSize?: number;
}

/**
 * Drop-in audit log tab (AUD-02). Renders a flat read-only list of AdminAuditLog rows
 * for a given (entity, entity_id) tuple. Phase 3-9 detail pages will use this
 * verbatim — no per-entity customization. Server enforces RBAC narrowing
 * (D-02 + D-24); this tab fetches whatever the actor is allowed to see.
 *
 * Empty + loading + error states are all surfaced with i18n strings under
 * admin.audit.*.
 *
 * v1.0 keeps the row footprint minimal: ts (formatted) + action + actor_id +
 * meta-preview. Pretty-printed before/after diff is a v1.5 polish (CONTEXT
 * deferred ideas).
 *
 * D-22 — staleTime: 0 (real-time feed; staff expect fresh rows).
 */
export function AuditLogTab({ entity, entityId, pageSize = 50 }: AuditLogTabProps) {
    const t = useTranslations('admin.audit');
    // Coerce entityId to string at the boundary — admin-api expects VARCHAR(64).
    const entityIdStr = String(entityId);

    const { data, isLoading, isError } = useQuery<AuditListResponse>({
        queryKey: ['admin.audit.list', entity, entityIdStr, 1, pageSize],
        queryFn: () =>
            listAudit({
                entity,
                entity_id: entityIdStr,
                page: 1,
                page_size: pageSize,
            }),
        staleTime: 0,
    });

    if (isLoading) {
        return <div className='text-muted-foreground p-4 text-sm'>{t('loading')}</div>;
    }
    if (isError) {
        return <div className='text-destructive p-4 text-sm'>{t('error')}</div>;
    }
    const rows = data?.rows ?? [];
    if (rows.length === 0) {
        return <div className='text-muted-foreground p-4 text-sm'>{t('empty')}</div>;
    }

    return (
        <div className='flex flex-col gap-2 p-4'>
            {rows.map((r) => {
                const tsFormatted = new Date(r.ts * 1000).toLocaleString();
                return (
                    <div
                        key={r.id}
                        className='bg-card flex flex-col gap-1 rounded-md border p-3 text-sm'
                    >
                        <div className='flex items-center justify-between gap-2'>
                            <span className='font-medium'>{r.action}</span>
                            <span className='text-muted-foreground text-xs'>{tsFormatted}</span>
                        </div>
                        <div className='text-muted-foreground text-xs'>
                            {t('actor_label')}: {r.actor_id ?? t('actor_anonymous')}
                            {r.bulk_op_id ? ` • ${t('bulk_op_label')}: ${r.bulk_op_id}` : ''}
                        </div>
                        {r.meta ? (
                            <pre className='text-muted-foreground bg-muted/40 overflow-x-auto rounded p-2 text-xs'>
                                {JSON.stringify(r.meta, null, 2)}
                            </pre>
                        ) : null}
                    </div>
                );
            })}
            {data && data.total > rows.length ? (
                <div className='text-muted-foreground pt-2 text-xs'>
                    {t('truncated', { shown: rows.length, total: data.total })}
                </div>
            ) : null}
        </div>
    );
}
