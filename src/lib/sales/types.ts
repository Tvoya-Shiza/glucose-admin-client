/**
 * Phase 9 PAY-02 + PAY-03 + PAY-04 — Sale list/detail/refund/export wire shapes.
 *
 * Schema truths (verified against glucose-admin-api/prisma/schema.prisma:715-746):
 *   - Sale.created_at is `Int @db.UnsignedInt` (Unix seconds, NOT-NULL).
 *   - Sale.refund_at is `Int? @db.UnsignedInt` (Unix seconds, NULLABLE; null = active).
 *   - Sale.amount/tax/commission/discount/total_amount are Decimal(13,2) —
 *     serialized as STRING on the wire (BigInt-as-string posture extends to
 *     Decimal). Client must keep them opaque; never `Number(value)`.
 *   - PaymentMethod enum: credit | payment_channel | subscribe | group_access
 *     (schema lines 33-38).
 *   - SaleType enum: webinar | quiz | quiz_badge (schema lines 40-44).
 *   - Sale.manual_added Boolean — true = bulk-provisioning row from Phase 3
 *     USR-04 (admin-granted entitlement, not paid via Kaspi).
 *
 * Enum imports note: the admin-client does not currently re-export schema
 * enums. Plan 03 may decide to vendor a `@/lib/shared/enums` module; for now
 * we inline the literal-union types here so the types file is self-contained.
 */

export type PaymentMethodLit = 'credit' | 'payment_channel' | 'subscribe' | 'group_access';
export type SaleTypeLit = 'webinar' | 'quiz' | 'quiz_badge';

export interface SaleBuyerRef {
    id: number;
    full_name: string | null;
    email: string | null;
    mobile: string | null;
}

/** Phase 18 — group-scoped sales reference the granting Group instead of a User buyer. */
export interface SaleGroupRef {
    id: number;
    name: string;
}

export interface SaleRow {
    id: number;
    /** NULL for Phase 18 group-scoped grants — `group` is set instead. */
    buyer: SaleBuyerRef | null;
    /** NULL for direct (per-user) sales; populated for Phase 18 group grants. */
    group: SaleGroupRef | null;
    seller_id: number | null;
    type: SaleTypeLit | null;
    payment_method: PaymentMethodLit | null;
    amount: string;                    // Decimal-as-string
    total_amount: string | null;       // Decimal-as-string
    manual_added: boolean;
    created_at: number;                // Unix sec
    refund_at: number | null;          // Unix sec, null = active
    /** product_label = webinar.title || quiz.title || quiz_badge.title (server picks based on type). */
    product_label: string | null;
}

export interface SalePaymentTraceRow {
    id: number;
    txn_id: string;             // BigInt-as-string
    txn_date: number | null;
    sum: string;                // Decimal-as-string
    status: number | null;
}

export interface SaleDetail extends SaleRow {
    order_id: number | null;
    quiz_id: number | null;
    quiz_badge_id: number | null;
    webinar_id: number | null;
    tax: string | null;
    commission: string | null;
    discount: string | null;
    access_to_purchased_item: boolean;
    access_days: number | null;
    /**
     * Best-effort payment trace: KaspiPayment rows matched on
     * Sale.buyer_id == User.id == KaspiPayment.account.
     */
    payment_trace: SalePaymentTraceRow[];
}

export interface SaleListResponse {
    rows: SaleRow[];
    total: number;
    page: number;
    page_size: number;
    next_cursor: string | null;
}

export type SaleSortField = 'created_at' | 'id' | 'amount';
export type SaleSortOrder = 'asc' | 'desc';

export interface SaleListQuery {
    page?: number;
    page_size?: number;
    type?: SaleTypeLit;
    payment_method?: PaymentMethodLit;
    only_refunded?: boolean;
    only_manual?: boolean;
    date_from?: number;
    date_to?: number;
    /** Searches buyer full_name | email | mobile. */
    q?: string;
    sort?: SaleSortField;
    order?: SaleSortOrder;
    cursor?: string;
}

export interface RefundInput {
    /** Required (rhf+zod, D-24). UI rejects empty. */
    refund_reason: string;
}

export interface RefundResult {
    success: boolean;
    sale_id: number;
    refund_at: number;
}

export interface SaleExportInput {
    format: 'csv' | 'xlsx';
    type?: SaleTypeLit;
    payment_method?: PaymentMethodLit;
    only_refunded?: boolean;
    only_manual?: boolean;
    date_from?: number;
    date_to?: number;
    q?: string;
    sort?: SaleSortField;
    order?: SaleSortOrder;
}
