/**
 * Phase 9 ANL-01..04 — dashboard endpoint response shapes.
 *
 * Schema truths (verified against glucose-admin-api/prisma/schema.prisma):
 *   - Course completion is aggregated from CourseLearning rows
 *     (User.course_learnings).
 *   - "Active learner" / "member" entitlement = a Sale row with refund_at IS NULL.
 *     There is NO WebinarUser model in the schema — Sale = entitlement is the
 *     canonical pattern.
 *   - Test completion = QuizResult.status ∈ {passed, failed} (status is the
 *     QuizResultStatus enum on schema).
 *   - Revenue = SUM(KaspiPayment.sum) bucketed by KaspiPayment.txn_date (NOT
 *     created_at — schema does not have that column on KaspiPayment).
 *   - WebinarAssignmentHistory.status === 'pending' is the grading queue used
 *     by the teacher dashboard (D-11).
 *
 * Decimal sums are serialized as STRING; client must keep them opaque
 * (BigInt-as-string posture extends to Decimal per admin-api CLAUDE.md).
 */

export interface MonthlyRevenuePoint {
    /** ISO month string YYYY-MM (server-formatted in Asia/Almaty calendar boundaries). */
    month: string;
    /** Decimal-as-string. May be '0' for empty months in the 12-month window. */
    revenue: string;
    /** Number of payments contributing to this bucket. */
    payment_count: number;
}

export interface CompletionRatePoint {
    /** ISO date YYYY-MM-DD (rolling 30-day window, anchored to today in Asia/Almaty). */
    date: string;
    /** Float 0..1, rendered as percent on the chart. */
    completion_rate: number;
    /** Total quiz attempts on this day (for tooltip / context). */
    attempts: number;
}

export interface AdminKpiResponse {
    total_users: number;
    active_users_24h: number;
    active_users_7d: number;
    /** 0..1 */
    completion_rate_30d: number;
    test_attempts_30d: number;
    /** 0..1 */
    test_completion_rate_30d: number;
    /** Decimal-as-string. */
    revenue_current_month: string;
    revenue_trend_12m: MonthlyRevenuePoint[];
    completion_trend_30d: CompletionRatePoint[];
    /** Snapshot timestamp — Unix sec. Helps the UI show "as of N min ago" given the 5min cache. */
    snapshot_at: number;
}

export interface CuratorOverviewGroup {
    id: number;
    name: string;
    member_count: number;
    /** Average course-completion percent across members in window, 0..1 — null if no learners. */
    avg_progress: number | null;
    /** Active members with at least one quiz attempt in window. */
    active_members: number;
    /** Group-scoped completion rate: completed quiz attempts / total in window. */
    completion_rate: number | null;
}

export interface CuratorOverviewResponse {
    /** Time window in days; 'all' rendered server-side as a sentinel large number. */
    window_days: number | 'all';
    groups: CuratorOverviewGroup[];
    snapshot_at: number;
}

export interface TeacherOverviewCourse {
    id: number;
    title: string;
    /** Distinct students with non-refunded Sale rows on this course (per CONTEXT — Sale=entitlement). */
    student_count: number;
    /** Recent quiz results across the course's quizzes (last 7 days). */
    recent_results_7d: number;
}

export interface TeacherOverviewPendingAssignment {
    id: number;
    student_id: number;
    student_full_name: string | null;
    assignment_id: number;
    /**
     * Unix seconds. Schema column is BigInt @db.UnsignedBigInt -> serialized as
     * string by admin-api's BigIntStringInterceptor; admin-api server-side
     * collapses it back to number at the boundary because Unix seconds always
     * fit MAX_SAFE_INTEGER (typed as number here).
     */
    created_at: number;
}

export interface TeacherOverviewResponse {
    courses: TeacherOverviewCourse[];
    /**
     * WebinarAssignmentHistory rows with status='pending' where teacher = actor.
     * Capped at 50; pending_assignments_total signals truncation.
     */
    pending_assignments: TeacherOverviewPendingAssignment[];
    pending_assignments_total: number;
    snapshot_at: number;
}

export type AnalyticsRolePivot = 'admin' | 'curator' | 'teacher';

export interface AnalyticsQuery {
    /** Curator/teacher: time window in days. Default 7. Admin endpoint ignores this. */
    window_days?: 1 | 7 | 30;
    /** 'all' sentinel — server interprets as a wide window (e.g. 365*5 days). */
    window_all?: boolean;
    /**
     * Admin support pivot — D-19. Admin can pass `as_role=curator|teacher` to
     * fetch a dashboard as another role. Non-admin actors must omit (server
     * 403s otherwise).
     */
    as_role?: AnalyticsRolePivot;
}
