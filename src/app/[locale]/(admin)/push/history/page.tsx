import { PushHistoryTable } from './push-history-table';

/**
 * Phase 8 Plan 03 — Push history page (PSH-03, D-11).
 *
 * Server component shell — the table is client-side because it owns nuqs URL
 * state + TanStack Query.
 */
export default function HistoryPage() {
    return <PushHistoryTable />;
}
