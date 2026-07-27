'use client';

import { QuestionsTab as QuizQuestionsTab } from '@/app/[locale]/(admin)/quizzes/[id]/tabs/questions-tab';
import type { QuizQuestionType } from '@/lib/quizzes/types';

/**
 * Тренажёр прогоняет только эти типы (ТЗ 5.2.1). Остальные сервер молча
 * выбрасывает из раунда и флеш-карт, поэтому в редакторе их не предлагаем —
 * иначе методист заведёт вопрос, который ученик никогда не увидит.
 */
const TRAINER_QUESTION_TYPES: QuizQuestionType[] = ['single', 'multiple'];

/**
 * Phase 38 — trainer Questions tab.
 *
 * A trainer's id IS a `quizzes` row (kind='trainer'), and the admin-api question
 * surface (`/admin-api/v1/admin/quizzes/:quizId/questions*`) has NO kind filter,
 * so the existing quizzes question editor works verbatim against a trainer id.
 * We mount it directly rather than fork it — every editor affordance (dnd reorder,
 * Excel import, force-confirm on destructive edits) keeps working with zero
 * duplication; the type picker is narrowed to what a trainer can actually run.
 *
 * Adaptation note: the reused editor lives in the `admin.quizzes` i18n namespace
 * and gates on the `quizzes.edit` permission (question editing is genuinely the
 * quiz surface). This is intentional reuse, not a trainer-specific fork.
 */
export function QuestionsTab({ trainerId }: { trainerId: number }) {
    return <QuizQuestionsTab quizId={trainerId} allowedTypes={TRAINER_QUESTION_TYPES} />;
}
