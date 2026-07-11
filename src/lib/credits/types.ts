import type {
    CreditBankStatus,
    CreditDifficulty,
    CreditFinishReason,
    CreditLaunchStatus,
    CreditPassType,
    CreditQuestionDeficit,
    CreditQuestionMark,
    CreditResultTextRange,
    CreditSessionStatus,
    CreditStatus,
} from '@shared/credits';

/**
 * «Зачёт» (oral credit) — admin-client types. Phase 34.
 *
 * Mirrors the admin-api surface defined in CREDITS_CONTRACT.md. Credit-domain
 * ids (credits, topics, questions, launches, sessions) are BigInt in MySQL and
 * serialized as STRINGS by the admin-api interceptor — typed as `string` here
 * and NEVER passed through `Number()`. User / group / course / chapter /
 * chapter-item ids remain numbers.
 */

// Re-export the vendored shared-types so feature code imports everything from
// '@/lib/credits/types' (single import surface, mirrors lib/quizzes/types.ts).
export type {
    CreditBankStatus,
    CreditDifficulty,
    CreditFinishReason,
    CreditLaunchStatus,
    CreditPassType,
    CreditQuestionDeficit,
    CreditQuestionMark,
    CreditResultTextRange,
    CreditSessionStatus,
    CreditStatus,
};

// ──────────────────────────────────────────────────────────────────────────────
// Shared refs
// ──────────────────────────────────────────────────────────────────────────────

export interface CreditCourseRef {
    id: number;
    title: string;
}

export interface CreditChapterRef {
    id: number;
    title: string;
}

export interface CreditGroupRef {
    id: number;
    name: string;
}

export interface CreditStudentRef {
    id: number;
    full_name: string | null;
}

export interface CreditLessonRef {
    chapter_item_id: number;
    title: string | null;
}

export interface CreditRowStats {
    students: number;
    passed: number;
    failed: number;
    pending: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Topics
// ──────────────────────────────────────────────────────────────────────────────

export interface CreditTopic {
    id: string;
    parent_id: string | null;
    name: string;
    position: number;
    status: CreditBankStatus;
    question_count: number;
    child_count: number;
    /**
     * Phase 36 — set when this topic mirrors a course lesson (a chapter item);
     * both null for free-form custom topics («Тақырыптар»).
     */
    course_id: number | null;
    chapter_item_id: number | null;
}

export interface CreateCreditTopicPayload {
    parent_id?: string | null;
    name: string;
    position?: number;
}

export interface UpdateCreditTopicPayload {
    name?: string;
    parent_id?: string | null;
    position?: number;
    status?: CreditBankStatus;
}

// ──────────────────────────────────────────────────────────────────────────────
// Question bank
// ──────────────────────────────────────────────────────────────────────────────

export interface CreditQuestionTopicRef {
    id: string;
    name: string;
    /** Phase 36 — present when the question is tagged to a course lesson (else null). */
    course_id: number | null;
    chapter_item_id: number | null;
}

export interface CreditQuestionRow {
    id: string;
    topic: CreditQuestionTopicRef;
    difficulty: CreditDifficulty;
    /** Sanitized Tiptap HTML. */
    question: string;
    answer: string;
    /** Optional relative upload URLs (null when no photo). answer_image is curator-only. */
    question_image: string | null;
    answer_image: string | null;
    score: number;
    status: CreditBankStatus;
    created_at: number;
    updated_at: number | null;
}

export interface ListCreditQuestionsQuery {
    topic_id?: string;
    include_descendants?: boolean;
    difficulty?: CreditDifficulty;
    status?: CreditBankStatus;
    search?: string;
    page?: number;
    page_size?: number;
}

export interface CreditQuestionListResponse {
    rows: CreditQuestionRow[];
    total: number;
    pageCount: number;
}

/**
 * Supply EXACTLY ONE tag: `topic_id` (an existing custom topic) or
 * `chapter_item_id` (a course lesson — admin-api lazily materializes its
 * lesson-topic). The server enforces the XOR.
 */
export interface CreateCreditQuestionPayload {
    topic_id?: string;
    chapter_item_id?: number;
    difficulty: CreditDifficulty;
    question: string;
    answer: string;
    /** Relative upload URLs; omit or '' for none. answer_image is curator-only. */
    question_image?: string;
    answer_image?: string;
    score?: number;
}

export interface UpdateCreditQuestionPayload {
    /** Re-tag with EITHER topic_id OR chapter_item_id (never both); omit both to keep. */
    topic_id?: string;
    chapter_item_id?: number;
    difficulty?: CreditDifficulty;
    question?: string;
    answer?: string;
    /** '' clears the photo; omit to leave unchanged. */
    question_image?: string;
    answer_image?: string;
    score?: number;
    status?: CreditBankStatus;
}

// ──────────────────────────────────────────────────────────────────────────────
// Excel bulk import (item 1)
// ──────────────────────────────────────────────────────────────────────────────

export interface CreditQuestionImportRow {
    row: number;
    status: 'ok' | 'error';
    reason: string | null;
    question_id: string | null;
}

export interface CreditQuestionImportResult {
    total: number;
    succeeded: number;
    failed: number;
    rows: CreditQuestionImportRow[];
}

/** Per-topic active-question counts by difficulty (wizard availability check). */
export interface CreditTopicAvailability {
    topic_id: string;
    counts: Record<CreditDifficulty, number>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Credits CRUD
// ──────────────────────────────────────────────────────────────────────────────

export interface CreditRow {
    id: string;
    title: string;
    course: CreditCourseRef | null;
    chapter: CreditChapterRef | null;
    group: CreditGroupRef | null;
    scheduled_at: number | null;
    status: CreditStatus;
    lessons: CreditLessonRef[];
    stats: CreditRowStats;
    last_launch_at: number | null;
    created_at: number;
}

export interface ListCreditsQuery {
    course_id?: number;
    group_id?: number;
    status?: CreditStatus;
    search?: string;
    date_from?: number;
    date_to?: number;
    page?: number;
    page_size?: number;
}

export interface CreditListResponse {
    rows: CreditRow[];
    total: number;
    pageCount: number;
}

export interface CreditCalendarEntry {
    id: string;
    title: string;
    scheduled_at: number | null;
    group: CreditGroupRef | null;
    course: CreditCourseRef | null;
    status: CreditStatus;
}

export interface CreditDetail {
    id: string;
    title: string;
    description: string | null;
    course: CreditCourseRef | null;
    chapter: CreditChapterRef | null;
    group: CreditGroupRef | null;
    scheduled_at: number | null;
    status: CreditStatus;
    lesson_item_ids: number[];
    lessons?: CreditLessonRef[];
    stats?: CreditRowStats;
    /** Launches summary included on the detail payload. */
    launches?: CreditLaunchRow[];
    last_launch_at?: number | null;
    created_at: number;
    updated_at?: number | null;
}

export interface CreateCreditPayload {
    course_id: number;
    chapter_id: number;
    group_id: number;
    title: string;
    description?: string;
    scheduled_at?: number;
    lesson_item_ids?: number[];
}

export interface UpdateCreditPayload {
    course_id?: number;
    chapter_id?: number;
    group_id?: number;
    title?: string;
    description?: string;
    scheduled_at?: number;
    lesson_item_ids?: number[];
    status?: CreditStatus;
}

// ──────────────────────────────────────────────────────────────────────────────
// History + eligible students
// ──────────────────────────────────────────────────────────────────────────────

export interface CreditHistoryRow {
    session_id: string;
    launch_id: string;
    student: CreditStudentRef;
    attempt_number: number;
    started_at: number | null;
    finished_at: number | null;
    /** null until the session is finalized (pending / in_progress rows). */
    score: number | null;
    max_score: number;
    /** null until the session is finalized. */
    percent: number | null;
    status: CreditSessionStatus;
    passed: boolean | null;
    retake_at: number | null;
}

export interface ListCreditHistoryQuery {
    student_id?: number;
    status?: CreditSessionStatus;
    page?: number;
    page_size?: number;
}

export interface CreditHistoryListResponse {
    rows: CreditHistoryRow[];
    total: number;
    pageCount: number;
}

export interface CreditEligibleStudent {
    id: number;
    full_name: string;
    email: string | null;
    passed: boolean;
    attempts_used: number;
    active_session_id: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Launches
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateCreditLaunchPayload {
    student_ids: number[];
    topic_ids: string[];
    question_count: number;
    difficulty_template: CreditDifficulty[];
    duration_sec: number;
    pass_type: CreditPassType;
    pass_value: number;
}

export interface CreditLaunchSessionSummary {
    id: string;
    student: CreditStudentRef;
    status: CreditSessionStatus;
    attempt_number: number;
    correct_count: number;
    incorrect_count: number;
    answered_count: number;
    question_count: number;
    score_so_far: number;
    max_score: number;
    passed: boolean | null;
    ends_at: number | null;
    remaining_sec: number | null;
}

export interface CreditLaunchDetail {
    id: string;
    credit_id: string;
    status: CreditLaunchStatus;
    question_count: number;
    difficulty_template: CreditDifficulty[];
    duration_sec: number;
    pass_type: CreditPassType;
    pass_value: number;
    topic_ids?: string[];
    created_at?: number;
    sessions: CreditLaunchSessionSummary[];
}

export interface CreditLaunchRow {
    id: string;
    status: CreditLaunchStatus;
    question_count: number;
    duration_sec: number;
    pass_type: CreditPassType;
    pass_value: number;
    created_at: number;
    curator?: { id: number; full_name: string | null } | null;
    /** Total sessions in the launch (present on both the list and detail.launches payloads). */
    session_count: number;
    /** Present on the launches-list payload only (absent on detail.launches). */
    passed_count?: number;
    /** pending + in_progress — sessions not yet finalized. List payload only. */
    active_count?: number;
}

export interface ListCreditLaunchesQuery {
    page?: number;
    page_size?: number;
}

export interface CreditLaunchListResponse {
    rows: CreditLaunchRow[];
    total: number;
    pageCount: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Conduct (sessions — FULL curator view, reference answers included)
// ──────────────────────────────────────────────────────────────────────────────

export interface CreditSessionQuestionDetail {
    position: number;
    difficulty: CreditDifficulty;
    score: number;
    /** Sanitized Tiptap HTML. */
    question: string;
    answer: string;
    /** Optional relative upload URLs (null when no photo). answer_image is curator-only. */
    question_image: string | null;
    answer_image: string | null;
    mark: CreditQuestionMark;
    marked_at: number | null;
}

export interface CreditSessionResultDetail {
    score: number;
    max_score: number;
    percent: number;
    passed: boolean;
    pass_threshold: number;
    finish_reason: CreditFinishReason;
    /** Admin-editable motivational message for the % range (item 4); '' if unset. */
    motivational_text: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Cross-credit results page (item 9)
// ──────────────────────────────────────────────────────────────────────────────

export interface CreditResultRow {
    session_id: string;
    launch_id: string;
    credit: { id: string; title: string; course: CreditCourseRef; group: CreditGroupRef };
    student: { id: number; full_name: string | null; mobile: string | null };
    attempt_number: number;
    started_at: number | null;
    finished_at: number | null;
    score: number | null;
    max_score: number;
    percent: number | null;
    status: CreditSessionStatus;
    passed: boolean | null;
    retake_at: number | null;
}

export interface ListCreditResultsQuery {
    search?: string;
    status?: CreditSessionStatus;
    course_id?: number;
    group_id?: number;
    /** 'true' | 'false' */
    passed?: string;
    date_from?: number;
    date_to?: number;
    page?: number;
    page_size?: number;
}

export interface CreditResultsListResponse {
    rows: CreditResultRow[];
    total: number;
    pageCount: number;
}

export interface CreditSessionDetail {
    id: string;
    launch_id: string;
    credit_id: string;
    student: CreditStudentRef;
    status: CreditSessionStatus;
    attempt_number: number;
    current_position: number | null;
    duration_sec: number;
    started_at: number | null;
    ends_at: number | null;
    /** Unix seconds on the server at response time — clock-skew correction. */
    server_now: number;
    remaining_sec: number | null;
    questions: CreditSessionQuestionDetail[];
    result: CreditSessionResultDetail | null;
    retake_at: number | null;
}
