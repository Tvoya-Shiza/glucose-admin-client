import type { TrainerThemePalette } from '@shared/trainers';

/**
 * TS types mirroring admin-api «Тренажёр» DTO shapes (Phase 38).
 *
 * Manually maintained — must change in lockstep with
 * glucose-admin-api/src/modules/trainers/dto/*.dto.ts and the row/detail
 * projections in trainers.service.ts / trainer-results.service.ts.
 *
 * A trainer IS a `quizzes` row (kind='trainer') + a trainer_settings satellite +
 * trainer_courses links — there is no separate trainer entity. Consequences that
 * matter for these types:
 *   - `publish_status` is DERIVED from Quizzes.status ('public' ⇔ active,
 *     'hidden' ⇔ inactive) — NOT a stored column.
 *   - `attempts_limit` maps to Quizzes.attempt where 0 (unlimited) is stored NULL
 *     and returned as `null`. The FORM uses 0 = unlimited (NOT null) per the ТЗ.
 *
 * BigInt-as-string (admin-client CLAUDE.md "BigInt-as-string from admin-api"):
 *   - TrainerAttempt.id (result row `id`) is BigInt → serialized as a STRING.
 *     Treat it as an opaque id; do NOT call Number() on it.
 *   - Trainer id (Quizzes.id), category_id, course/webinar ids, group_id, user_id
 *     are all `Int` on the schema → typed as `number` here (safe for math).
 *   - Every timestamp (created_at, updated_at, available_from/to, started_at,
 *     finished_at) is Unix SECONDS (`number`), NOT ISO strings.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Enums / unions
// ──────────────────────────────────────────────────────────────────────────────

export type TrainerPublishStatus = 'hidden' | 'public';
export type TrainerAttemptStatus = 'in_progress' | 'paused' | 'finished' | 'abandoned';
export type TrainerAttemptMode = 'trainer' | 'flashcards';
export type TrainerResultsSortField = 'started_at' | 'score';
export type SortOrder = 'asc' | 'desc';
export type Locale = 'kz';

// ──────────────────────────────────────────────────────────────────────────────
// Shared refs
// ──────────────────────────────────────────────────────────────────────────────

export interface TrainerCategoryRef {
    id: number;
    title_kz: string | null;
}

/** Предмет тренажёра (phase-43) — по нему ученик фильтрует список. */
export interface TrainerSubjectRef {
    id: number;
    title_kz: string | null;
}

/** Тема оформления игры (phase-43): фон + ключ палитры плиток. */
export interface TrainerThemeRef {
    id: number;
    title: string;
    image: string | null;
    palette: TrainerThemePalette;
}

export interface TrainerThemeRow extends TrainerThemeRef {
    sort_order: number;
    is_active: boolean;
    /** Сколько тренажёров держат эту тему по умолчанию. */
    trainer_count: number;
    created_at: number | null;
    updated_at: number | null;
}

export interface TrainerThemeListResponse {
    rows: TrainerThemeRow[];
    total: number;
    pageCount: number;
}

export interface ListTrainerThemesQuery {
    page?: number;
    page_size?: number;
    q?: string;
    active_only?: 'true';
}

export interface UpsertTrainerTheme {
    title: string;
    image?: string | null;
    palette?: TrainerThemePalette;
    sort_order?: number;
    is_active?: boolean;
}

export interface TrainerCourseRef {
    id: number;
    title_kz: string | null;
}

export interface TrainerTranslation {
    locale: Locale;
    title: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// List (mirrors trainers.service.ts TrainerRowDto + list-trainers.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface ListTrainersQuery {
    page?: number;
    page_size?: number;
    q?: string;
    publish_status?: TrainerPublishStatus;
    category_id?: number;
    /** Webinar (course) id linked via trainer_courses. */
    course_id?: number;
}

export interface TrainerRow {
    id: number;
    title_kz: string | null;
    category: TrainerCategoryRef | null;
    /** Counts ONLY single/multiple bank questions (the trainer-runnable types). */
    question_count: number;
    publish_status: TrainerPublishStatus;
    timer_enabled: boolean;
    seconds_per_question: number | null;
    /** null = unlimited (Quizzes.attempt NULL). */
    attempts_limit: number | null;
    /** Unix seconds. null = no window bound. */
    available_from: number | null;
    /** Unix seconds. null = no window bound. */
    available_to: number | null;
    flashcards_enabled: boolean;
    courses: TrainerCourseRef[];
    attempts_count: number;
    /** Unix seconds. */
    created_at: number;
}

export interface TrainerListResponse {
    rows: TrainerRow[];
    total: number;
    pageCount: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Detail (mirrors trainers.service.ts readDetail projection)
// ──────────────────────────────────────────────────────────────────────────────

export interface TrainerDetailCounts {
    question_count: number;
    attempts_count: number;
}

export interface TrainerDetail {
    id: number;
    title_kz: string | null;
    translations: TrainerTranslation[];
    category: TrainerCategoryRef | null;
    subject: TrainerSubjectRef | null;
    theme: TrainerThemeRef | null;
    publish_status: TrainerPublishStatus;
    timer_enabled: boolean;
    seconds_per_question: number | null;
    /** ⇔ Quizzes.display_questions_randomly. */
    shuffle_questions: boolean;
    shuffle_answers: boolean;
    flashcards_enabled: boolean;
    /** null = unlimited. */
    attempts_limit: number | null;
    background_image: string | null;
    /** Unix seconds. */
    available_from: number | null;
    /** Unix seconds. */
    available_to: number | null;
    courses: TrainerCourseRef[];
    counts: TrainerDetailCounts;
    /** Unix seconds. */
    created_at: number;
    /** Unix seconds. null when never updated. */
    updated_at: number | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Mutations — payloads (mirror create-trainer.dto.ts + update-trainer.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateTrainer {
    title: string;
    category_id?: number | null;
    subject_id?: number | null;
    theme_id?: number | null;
    timer_enabled?: boolean;
    /** Required by the server when timer_enabled=true. 5..600. */
    seconds_per_question?: number | null;
    shuffle_questions?: boolean;
    shuffle_answers?: boolean;
    flashcards_enabled?: boolean;
    /** 0 = unlimited (stored NULL server-side). NOT null. */
    attempts_limit?: number | null;
    background_image?: string | null;
    /** Unix seconds. Must be < available_to when both present. */
    available_from?: number | null;
    /** Unix seconds. */
    available_to?: number | null;
    /** Webinar ids linked via trainer_courses (each must exist, non-deleted). */
    course_ids?: number[];
}

/**
 * Partial update. Every field optional:
 *   - undefined → leave unchanged
 *   - null      → clear (nullable columns)
 * `course_ids` (when present) DIFF-REPLACES the trainer_courses link set.
 */
export interface UpdateTrainer {
    title?: string;
    category_id?: number | null;
    subject_id?: number | null;
    theme_id?: number | null;
    timer_enabled?: boolean;
    seconds_per_question?: number | null;
    shuffle_questions?: boolean;
    shuffle_answers?: boolean;
    flashcards_enabled?: boolean;
    attempts_limit?: number | null;
    background_image?: string | null;
    available_from?: number | null;
    available_to?: number | null;
    course_ids?: number[];
}

export interface PublishTrainer {
    publish_status: TrainerPublishStatus;
}

export interface PublishTrainerResult {
    id: number;
    publish_status: TrainerPublishStatus;
}

export interface DeleteTrainerResult {
    id: number;
    publish_status: 'hidden';
    deleted: true;
}

/**
 * 409 body shape returned by PATCH /trainers/:id/publish when publishing is
 * blocked (zero runnable questions OR zero linked courses). Surfaced so the UI
 * can explain WHY the toggle refused. Mirrors the service ConflictException
 * `{ status, message, question_count, course_count }`.
 */
export interface TrainerPublishBlocked {
    status: 'trainers.publish_blocked';
    message: string;
    question_count: number;
    course_count: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Results (mirror list-trainer-results.dto.ts + TrainerResultRowDto)
// ──────────────────────────────────────────────────────────────────────────────

export interface ListTrainerResultsQuery {
    trainer_id?: number;
    user_id?: number;
    group_id?: number;
    /** Webinar (course) id — narrows via trainer_courses. */
    course_id?: number;
    status?: TrainerAttemptStatus;
    mode?: TrainerAttemptMode;
    /** Unix seconds (on finished_at). */
    date_from?: number;
    /** Unix seconds (on finished_at). */
    date_to?: number;
    q?: string;
    sort?: TrainerResultsSortField;
    order?: SortOrder;
    page?: number;
    page_size?: number;
}

export interface TrainerResultTrainerRef {
    id: number;
    title_kz: string | null;
}

export interface TrainerResultUserRef {
    id: number;
    full_name: string | null;
    mobile: string | null;
}

export interface TrainerResultRow {
    /** trainer_attempts.id — BigInt serialized as string. Opaque id. */
    id: string;
    trainer: TrainerResultTrainerRef | null;
    user: TrainerResultUserRef | null;
    /** Names of every group the student belongs to. */
    groups: string[];
    attempt_number: number | null;
    mode: TrainerAttemptMode;
    status: TrainerAttemptStatus;
    score: number;
    max_score: number;
    correct_count: number;
    incorrect_count: number;
    skipped_count: number;
    elapsed_sec: number;
    /** Unix seconds. */
    started_at: number;
    /** Unix seconds. null while unfinished. */
    finished_at: number | null;
}

export interface TrainerResultsListResponse {
    rows: TrainerResultRow[];
    total: number;
    pageCount: number;
}

export interface TrainerResultsStatsResponse {
    total: number;
    finished: number;
    in_progress: number;
    /** Mean score/max_score*100 over finished attempts with max_score>0; null when none. */
    avg_score_percent: number | null;
    unique_students: number;
}

/**
 * POST /trainer-results/export body. Mirrors ListTrainerResultsQuery's filter set
 * (minus pagination — exports never paginate) with a required `format`.
 */
export interface ExportTrainerResults {
    format: 'csv' | 'xlsx';
    trainer_id?: number;
    user_id?: number;
    group_id?: number;
    course_id?: number;
    status?: TrainerAttemptStatus;
    mode?: TrainerAttemptMode;
    date_from?: number;
    date_to?: number;
    q?: string;
    sort?: TrainerResultsSortField;
    order?: SortOrder;
}

/**
 * Разбор попытки по вопросам (GET /trainer-results/:id/answers).
 *
 * Строится из снапшота вопроса, записанного при старте попытки, — поэтому
 * показывает ровно то, что видел ученик, даже если банк вопросов потом правили.
 */
export interface TrainerAnswerOption {
    id: number;
    title: string;
    image: string | null;
    is_correct: boolean;
    is_chosen: boolean;
}

export interface TrainerAttemptAnswer {
    question_id: number;
    position: number;
    type: string;
    title: string;
    image: string | null;
    outcome: string;
    points_awarded: number;
    points_possible: number;
    time_spent_sec: number | null;
    options: TrainerAnswerOption[];
}

export interface TrainerAttemptAnswers {
    id: string;
    user: { id: number; full_name: string | null; email: string | null } | null;
    trainer: { id: number; title_kz: string | null } | null;
    status: TrainerAttemptStatus;
    attempt_number: number | null;
    score: number;
    max_score: number;
    correct_count: number;
    incorrect_count: number;
    skipped_count: number;
    rounds_played: number;
    elapsed_sec: number;
    finished_at: number | null;
    answers: TrainerAttemptAnswer[];
}
