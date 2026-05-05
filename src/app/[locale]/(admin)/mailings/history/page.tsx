import { MailingsHistoryTable } from './mailings-history-table';

/**
 * Phase 8 Plan 05 — Mailings history page (PSH-06, D-16).
 *
 * Server component shell — the table is client-side because it owns nuqs URL
 * state + TanStack Query.
 */
export default function HistoryPage() {
    return <MailingsHistoryTable />;
}
