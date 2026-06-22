/**
 * TS types mirroring admin-api Assignments DTO shapes.
 *
 * Manually maintained — keep in lockstep with
 * glucose-admin-api/src/modules/assignments/dto/*.dto.ts.
 *
 * BigInt note: WebinarAssignment.created_at + WebinarAssignmentHistory.created_at
 * + WebinarAssignmentHistoryMessage.created_at are all `BigInt` on the schema →
 * typed as `string` here per CLAUDE.md "BigInt-as-string from admin-api". Never
 * call Number() on them; render via formatUnixDate helpers.
 *
 * WebinarAssignment.id, WebinarAssignmentTranslation.id, ...History.id,
 * ...Attachment.id, ...HistoryMessage.id are all `Int` → `number` here.
 */

export type AssignmentStatus = 'active' | 'inactive';
export type AssignmentRowLocale = 'kz' | 'ru';
export type AssignmentSortField = 'created_at' | 'deadline' | 'title';
export type SortOrder = 'asc' | 'desc';
export type SubmissionStatus = 'pending' | 'passed' | 'not_passed' | 'not_submitted';

export interface ListAssignmentsQuery {
    page?: number;
    page_size?: number;
    status?: AssignmentStatus;
    webinar_id?: number;
    chapter_id?: number;
    q?: string;
    sort?: AssignmentSortField;
    order?: SortOrder;
}

export interface AssignmentRow {
    id: number;
    title_ru: string | null;
    title_kz: string | null;
    status: AssignmentStatus;
    /** Nullable: standalone assignments aren't yet bound to a course. */
    webinar_id: number | null;
    webinar_title_ru: string | null;
    /** Nullable: standalone assignments aren't yet bound to a chapter. */
    chapter_id: number | null;
    deadline: number | null;
    attempts: number | null;
    pass_grade: number | null;
    grade: number | null;
    attachment_count: number;
    submission_count: number;
    pending_review_count: number;
    translation_completeness: 'complete' | 'incomplete';
    missing_locales: AssignmentRowLocale[];
    /** Unix seconds as decimal string. */
    created_at: string;
}

export interface AssignmentListResponse {
    rows: AssignmentRow[];
    total: number;
    page: number;
    page_size: number;
}

export interface AssignmentTranslation {
    locale: 'ru' | 'kz';
    title: string;
    description: string;
}

export interface AssignmentAttachment {
    id: number;
    title: string;
    attach: string;
}

export interface AssignmentDetail {
    id: number;
    webinar_id: number | null;
    chapter_id: number | null;
    creator_id: number;
    status: AssignmentStatus;
    grade: number | null;
    pass_grade: number | null;
    deadline: number | null;
    attempts: number | null;
    check_previous_parts: boolean;
    access_after_day: number | null;
    translations: AssignmentTranslation[];
    attachments: AssignmentAttachment[];
    submission_count: number;
    pending_review_count: number;
    /** Unix seconds as decimal string. */
    created_at: string;
}

export interface CreateAssignmentPayload {
    /** Optional — when omitted the assignment is standalone (bound later via course content). */
    webinar_id?: number;
    chapter_id?: number;
    status?: AssignmentStatus;
    grade?: number;
    pass_grade?: number;
    deadline?: number;
    attempts?: number;
    check_previous_parts?: boolean;
    access_after_day?: number;
    translations: AssignmentTranslation[];
}

export type UpdateAssignmentPayload = Partial<Omit<CreateAssignmentPayload, 'webinar_id'>>;

export interface UpsertAttachmentPayload {
    title: string;
    attach: string;
}

export interface AssignmentAnalytics {
    active_count: number;
    inactive_count: number;
    submissions_total: number;
    submissions_30d: number;
    pending_review_count: number;
    completion_rate: number | null;
    avg_grade: number | null;
    deadline_missed_count: number;
    time_to_grade_median_hours: number | null;
    sparkline: Array<{ bucket: number; submissions: number }>;
}

export interface ListSubmissionsQuery {
    page?: number;
    page_size?: number;
    status?: SubmissionStatus;
    /** Filter to submissions whose student belongs to this group (поток / ағым). */
    group_id?: number;
    q?: string;
    sort?: 'created_at' | 'grade';
    order?: SortOrder;
}

export interface SubmissionRow {
    history_id: number;
    student_id: number;
    student_name: string | null;
    status: SubmissionStatus;
    grade: number | null;
    /** Unix seconds as decimal string. */
    submitted_at: string;
    files_count: number;
    has_curator_reply: boolean;
}

export interface SubmissionListResponse {
    rows: SubmissionRow[];
    total: number;
    page: number;
    page_size: number;
}

export interface SubmissionMessage {
    id: number;
    sender_id: number;
    sender_name: string | null;
    sender_role: string | null;
    message: string;
    /** Legacy single-shot column; new replies use polymorphic message rows. */
    curator_comment: string | null;
    /** Display name (mojibake-normalized by admin-api). */
    file_title: string | null;
    /**
     * admin-api path for the attached file
     * (`/v1/admin/assignments/.../messages/:id/file`). The browser fetches it
     * through the BFF proxy as `/api/proxy${file_url}`. null when no attachment.
     */
    file_url: string | null;
    /** Unix seconds as decimal string. */
    created_at: string;
}

export interface SubmissionDetail {
    history_id: number;
    assignment_id: number;
    student_id: number;
    student_name: string | null;
    instructor_id: number;
    status: SubmissionStatus;
    grade: number | null;
    submitted_at: string;
    messages: SubmissionMessage[];
}

export interface GradeSubmissionPayload {
    status: SubmissionStatus;
    grade?: number;
    comment?: string;
}
