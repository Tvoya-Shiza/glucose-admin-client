'use client';

import { TrainerResultsList } from '../components/trainer-results-list';

/**
 * Phase 38 — trainer Results tab (ТЗ §5.6).
 *
 * Renders the trainer-scoped results list. Server-side RBAC narrows visibility
 * regardless of UI (admin all; curator → supervised groups' students; teacher →
 * trainers linked to own webinars, default-deny). The tab is only mounted when the
 * actor holds `trainers.results_view` (enforced in TrainerDetailClient).
 */
export function ResultsTab({ trainerId }: { trainerId: number }) {
    return <TrainerResultsList trainerId={trainerId} />;
}
