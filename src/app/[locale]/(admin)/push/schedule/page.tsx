import { ScheduledListTable } from './scheduled-list-table';

/**
 * Phase 8 Plan 04 — schedule queue page (PSH-02).
 *
 * Server-component shell; the table is a client component that subscribes to
 * /admin-api/v1/admin/push/scheduled via TanStack Query and renders the
 * paginated queue with status filters + cancel actions.
 *
 * Layout/tabs come from the parent /push/layout.tsx (Plan 03). RBAC: admin-only;
 * AdminNav already hides the link for curator/teacher (Plan 01 adminOnly flag),
 * and admin-api enforces it via @Roles('admin').
 */
export default function PushSchedulePage() {
    return <ScheduledListTable />;
}
