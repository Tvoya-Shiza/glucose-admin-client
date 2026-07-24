'use client';

import { QuestionsTab as QuizQuestionsTab } from '@/app/[locale]/(admin)/quizzes/[id]/tabs/questions-tab';

/**
 * Phase 38 — trainer Questions tab.
 *
 * A trainer's id IS a `quizzes` row (kind='trainer'), and the admin-api question
 * surface (`/admin-api/v1/admin/quizzes/:quizId/questions*`) has NO kind filter,
 * so the existing quizzes question editor works verbatim against a trainer id.
 * We mount it directly rather than fork it — this keeps single/multiple (the only
 * trainer-runnable types) plus every other editor affordance (dnd reorder, Excel
 * import, force-confirm on destructive edits) working with zero duplication.
 *
 * Adaptation note: the reused editor lives in the `admin.quizzes` i18n namespace
 * and gates on the `quizzes.edit` permission (question editing is genuinely the
 * quiz surface). This is intentional reuse, not a trainer-specific fork.
 */
export function QuestionsTab({ trainerId }: { trainerId: number }) {
    return <QuizQuestionsTab quizId={trainerId} />;
}
