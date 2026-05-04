/**
 * TS types mirroring admin-api Quizzes DTO shapes (Phase 6 Plan 01).
 *
 * Manually maintained — must change in lockstep with
 * glucose-admin-api/src/modules/quizzes/dto/*.dto.ts.
 *
 * BigInt note (admin-client CLAUDE.md "BigInt-as-string from admin-api"):
 *   - All Phase 6 entity ids — Quizzes.id, QuizQuestion.id, QuizQuestionAnswer.id,
 *     QuizCategory.id, QuizBadge.id, QuizBadgeItem.id, QuizResult.id,
 *     QuizBadgeResult.id — are `Int` on the schema → typed as `number` here.
 *     This is a NOT-A-BIGINT case for the entire Phase 6 surface; math (Number)
 *     is safe.
 *
 * Schema-truth deviations (carried from CONTEXT D-09 / D-15 reconciliation):
 *   - QuizBadge.created_at is `DateTime @default(now())` on the admin-api schema
 *     (line 643), NOT Unix Int. Admin-api's BigIntStringInterceptor does not
 *     touch Date — Nest serializes DateTime to ISO 8601 string. So
 *     QuizBadge.created_at / updated_at are typed as `string` here, while
 *     all OTHER created_at fields in Phase 6 (Quizzes, QuizQuestion, QuizResult)
 *     remain Unix `number`.
 *   - QuizQuestionAnswer has NO `order` column on the schema — answer order is
 *     by id ASC for v1. Reflected here: AnswerDetail has NO order field.
 *     Editor visual reorder is NOT persisted across reloads (deferred to v2).
 *   - QuizCategory has NO `name` column — display name lives in
 *     QuizCategoryTranslation.title per locale. Reflected here: QuizCategory
 *     has only `id`, `parent_id`, `subject_id`, `translations[]`, etc.
 *   - QuizCategory has NO `order` column — sibling tree order is by id ASC for v1.
 *     dnd-kit category reorder NOT persisted (deferred).
 *
 * Source-of-truth DTO file is cited in each section's comment.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Enums / unions
// ──────────────────────────────────────────────────────────────────────────────

export type QuizStatus = 'active' | 'inactive';
export type QuizQuestionType = 'single' | 'multiple' | 'descriptive' | 'identificative';
export type QuizResultStatus = 'waiting' | 'passed' | 'failed';
export type Locale = 'ru' | 'kz';
export type TranslationCompleteness = 'complete' | 'incomplete';
export type QuizSortField = 'created_at' | 'updated_at' | 'title';
export type SortOrder = 'asc' | 'desc';
export type QuestionCountBucket = 'none' | '1-10' | '11-30' | '31+';

// ──────────────────────────────────────────────────────────────────────────────
// Translation (mirrors admin-api translation.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface Translation {
    locale: Locale;
    title: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// List (mirrors admin-api list-quizzes.dto.ts + quiz-row.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface ListQuizzesQuery {
    page?: number;
    page_size?: number;
    status?: QuizStatus;
    category_id?: number;
    badge_id?: number;
    question_count_bucket?: QuestionCountBucket;
    q?: string;
    sort?: QuizSortField;
    order?: SortOrder;
}

export interface QuizRowCategoryRef {
    id: number;
    title_ru: string | null;
}

export interface QuizRowBadgeRef {
    id: number;
    title_ru: string | null;
}

export interface QuizRow {
    id: number;
    status: QuizStatus;
    /** Phase 1.08 versioning column — surfaced for the "v{n}" pill. */
    version: number;
    category: QuizRowCategoryRef | null;
    /** Seconds. null = no time limit. */
    time: number | null;
    pass_mark: number;
    /** null = unlimited attempts. */
    attempt: number | null;
    certificate: boolean;
    /** _count.questions — server-side aggregate. */
    question_count: number;
    translation_completeness: TranslationCompleteness;
    missing_locales: Locale[];
    badges: QuizRowBadgeRef[];
    /** Unix seconds. */
    created_at: number;
    /** Unix seconds. null when never updated. */
    updated_at: number | null;
}

export interface QuizListResponse {
    rows: QuizRow[];
    total: number;
    page: number;
    page_size: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Detail (mirrors admin-api quiz-detail.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface QuestionTranslation {
    locale: Locale;
    title: string;
    /** Tiptap HTML (sanitized server-side in Plan 05). null = no body. */
    description: string | null;
    /** Descriptive-type "correct answer" text. null for non-descriptive types. */
    correct: string | null;
}

export interface AnswerTranslation {
    locale: Locale;
    title: string;
}

export interface AnswerDetail {
    id: number;
    /** Self-FK: null = LEFT-side or non-identificative; N = RIGHT-side pointing to LEFT.id. */
    parent_id: number | null;
    image: string | null;
    correct: boolean;
    translations: AnswerTranslation[];
    created_at: number;
    updated_at: number | null;
}

export interface QuestionDetail {
    id: number;
    type: QuizQuestionType;
    grade: number;
    image: string | null;
    video: string | null;
    answer_video_url: string | null;
    /** Persistent question order. null when never reordered. */
    order: number | null;
    translations: QuestionTranslation[];
    answers: AnswerDetail[];
    created_at: number;
    updated_at: number | null;
}

export interface QuizDetailCategoryRef {
    id: number;
    parent_id: number | null;
    title_ru: string | null;
}

export interface QuizDetailSubjectRef {
    id: number;
    title_ru: string | null;
}

export interface QuizDetailBadgeRef {
    id: number;
    title_ru: string | null;
    is_active: boolean;
}

export interface QuizDetailCounts {
    question_count: number;
    /** Server-recomputed sum of question.grade — mirrors Quizzes.total_mark. */
    total_mark: number;
}

export interface QuizDetail {
    id: number;
    status: QuizStatus;
    version: number;
    category: QuizDetailCategoryRef | null;
    subject: QuizDetailSubjectRef | null;
    /** Seconds. null = no time limit. */
    time: number | null;
    pass_mark: number;
    /** null = unlimited attempts. */
    attempt: number | null;
    certificate: boolean;
    display_questions_randomly: boolean;
    expiry_days: number | null;
    translations: Translation[];
    translation_completeness: TranslationCompleteness;
    missing_locales: Locale[];
    questions: QuestionDetail[];
    badges: QuizDetailBadgeRef[];
    counts: QuizDetailCounts;
    created_at: number;
    updated_at: number | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Mutations — payloads (mirrors create-quiz.dto.ts + update-quiz.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateQuiz {
    status?: QuizStatus;
    category_id?: number | null;
    subject_id?: number | null;
    /** Seconds. null|0 = no limit. */
    time?: number | null;
    pass_mark: number;
    /** null = unlimited. */
    attempt?: number | null;
    certificate?: boolean;
    display_questions_randomly?: boolean;
    expiry_days?: number | null;
    translations: Translation[];
}

export interface UpdateQuiz {
    status?: QuizStatus;
    category_id?: number | null;
    subject_id?: number | null;
    time?: number | null;
    pass_mark?: number;
    attempt?: number | null;
    certificate?: boolean;
    display_questions_randomly?: boolean;
    expiry_days?: number | null;
    translations?: Translation[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Question / Answer upserts (mirrors upsert-question.dto.ts + upsert-answer.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface UpsertQuestionTranslation {
    locale: Locale;
    title: string;
    /** Tiptap HTML. */
    description?: string | null;
    /** Descriptive-only correct text. Ignored for non-descriptive types. */
    correct?: string | null;
}

export interface UpsertQuestion {
    /** Omit on create. */
    id?: number;
    grade: number;
    type: QuizQuestionType;
    image?: string | null;
    video?: string | null;
    answer_video_url?: string | null;
    translations: UpsertQuestionTranslation[];
    /** Force-confirm JWT — only required on destructive edits with open attempts. */
    force_confirm_token?: string;
}

export interface UpsertAnswerTranslation {
    locale: Locale;
    title: string;
}

export interface UpsertAnswer {
    /** Omit on create. */
    id?: number;
    question_id: number;
    /**
     * IDENTIFICATIVE pair link: null for non-identificative types and LEFT-side
     * anchor rows; LEFT-side answer.id for RIGHT-side match rows.
     */
    parent_id?: number | null;
    correct: boolean;
    image?: string | null;
    translations: UpsertAnswerTranslation[];
    force_confirm_token?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Reorder (mirrors reorder-questions.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface ReorderQuestionsItem {
    id: number;
    order: number;
}

export interface ReorderQuestions {
    items: ReorderQuestionsItem[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Force-confirm 409 envelope (mirrors force-confirm.dto.ts ForceConfirmEnvelope)
// ──────────────────────────────────────────────────────────────────────────────

export interface ForceConfirmEnvelope {
    open_attempts_count: number;
    force_confirm_token: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// QuizCategory (mirrors upsert-category.dto.ts; flat list, client builds tree)
// ──────────────────────────────────────────────────────────────────────────────

export interface QuizCategory {
    id: number;
    /** null = root. */
    parent_id: number | null;
    subject_id: number | null;
    translations: Translation[];
    /** Number of quizzes assigned to this category (Plan 03 list response). */
    quiz_count?: number;
    /** Number of direct child categories (Plan 03 list response). */
    child_count?: number;
    /** Unix seconds (Int? on schema; null when not yet stamped). */
    created_at: number | null;
    /** Unix seconds. */
    updated_at: number | null;
}

/**
 * 409 cascade-blocked body shape returned by DELETE /quiz-categories/:id when
 * the category has dependents and ?force=true was not passed (Plan 03).
 */
export interface CategoryCascadeBlocked {
    status: 'quiz_categories.cascade_blocked';
    message: string;
    quiz_count: number;
    child_count: number;
}

/**
 * Successful delete payload (200) — surfaced when ?force=true is supplied or no
 * dependents existed. quizzes_repointed/children_repointed reflect the safe-cascade
 * (D-16 / T-06-31): quizzes were repointed to NULL category, children were
 * repointed to the deleted row's parent — quizzes survive.
 */
export interface CategoryDeleteResult {
    id: number;
    deleted: true;
    quizzes_repointed: number;
    children_repointed: number;
}

export interface UpsertCategory {
    /** Omit on create. */
    id?: number;
    parent_id?: number | null;
    subject_id?: number | null;
    translations: Translation[];
}

// ──────────────────────────────────────────────────────────────────────────────
// QuizBadge ("Пробное ЕНТ") (mirrors upsert-badge.dto.ts + upsert-badge-item.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * QuizBadge.created_at and updated_at are DateTime on schema — NOT Unix Int.
 * Admin-api emits ISO 8601 strings. ALL OTHER Phase 6 created_at fields are Unix Int.
 */
export interface QuizBadge {
    id: number;
    is_active: boolean;
    quiz_category_id: number | null;
    translations: Translation[];
    /** ISO 8601 string. NOT Unix Int. */
    created_at: string;
    /** ISO 8601 string. null until first update. */
    updated_at: string | null;
}

/**
 * Admin Plan 06 list/detail response shape — translations folded into a
 * { ru, kz } object for ergonomic rendering. item_count and results_count are
 * server-aggregated counts.
 */
export interface QuizBadgeRow {
    id: number;
    is_active: boolean;
    quiz_category_id: number | null;
    translations: { ru: string | null; kz: string | null };
    item_count: number;
    results_count: number;
    /** ISO 8601 string. */
    created_at: string;
    /** ISO 8601 string. null until first update. */
    updated_at: string | null;
}

export interface QuizBadgeItemRow {
    id: number;
    quiz_id: number;
    order: number | null;
    /** ISO 8601 string. */
    created_at: string;
    updated_at: string | null;
    quiz: {
        id: number;
        version: number;
        status: QuizStatus;
        translations: Translation[];
        question_count: number;
    } | null;
}

/** GET /quiz-badges/:id detail response. */
export interface QuizBadgeDetail extends QuizBadgeRow {
    items: QuizBadgeItemRow[];
}

export interface UpsertBadge {
    /** Omit on create. */
    id?: number;
    is_active?: boolean;
    quiz_category_id?: number | null;
    translations: Translation[];
}

/**
 * QuizBadgeItem also has DateTime created_at on schema. Items HAVE order.
 */
export interface QuizBadgeItem {
    id: number;
    quiz_badge_id: number;
    quiz_id: number;
    order: number | null;
    /** ISO 8601 string. */
    created_at: string;
    /** ISO 8601 string. null until first update. */
    updated_at: string | null;
}

export interface UpsertBadgeItem {
    /** Omit on create. */
    id?: number;
    quiz_badge_id: number;
    quiz_id: number;
    /** Optional on create — server auto-assigns MAX(order)+1. */
    order?: number;
}

export interface ReorderBadgeItemsEntry {
    id: number;
    order: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Results (mirrors list-results.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface ListResultsQuery {
    quiz_id?: number;
    badge_id?: number;
    user_id?: number;
    status?: QuizResultStatus;
    /** Unix seconds. */
    date_from?: number;
    /** Unix seconds. */
    date_to?: number;
    q?: string;
    page?: number;
    page_size?: number;
    sort?: 'created_at';
    order?: SortOrder;
}

export interface QuizResultUserRef {
    id: number;
    full_name: string | null;
    email: string | null;
}

export interface QuizResultQuizRef {
    id: number;
    title_ru: string | null;
}

export interface QuizResultRow {
    id: number;
    quiz: QuizResultQuizRef | null;
    user: QuizResultUserRef | null;
    /** webinar_id at attempt time — null when attempt was outside a course context. */
    webinar_id: number | null;
    /** Phase 1.08 snapshot — version of the quiz at attempt start. */
    quiz_version_at_start: number | null;
    user_grade: number | null;
    status: QuizResultStatus;
    /** Unix seconds. */
    created_at: number;
}

export interface QuizResultsListResponse {
    rows: QuizResultRow[];
    total: number;
    page: number;
    page_size: number;
}
