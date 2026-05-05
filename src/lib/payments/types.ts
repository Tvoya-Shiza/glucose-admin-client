/**
 * Phase 9 PAY-01 + PAY-04 — KaspiPayment list/detail/export wire shapes.
 *
 * Schema truths (verified against glucose-admin-api/prisma/schema.prisma:793-814):
 *   - KaspiPayment has NO created_at column. Temporal sort/filter is on
 *     `txn_date Int? @db.UnsignedInt` (Unix seconds, NULLABLE). The hot-path
 *     index `idx_kaspi_payments_txn_date` from Phase 1 Plan 08 covers this.
 *   - KaspiPayment.status is `Int?` (NO KaspiPaymentStatus enum exists in
 *     schema). Filter values are free-form integers; meanings are tracked in
 *     glucose-api business logic, not enforced by the schema.
 *   - txn_id is `BigInt @unique @db.UnsignedBigInt` -> serialized as STRING by
 *     admin-api's BigIntStringInterceptor. Treat as opaque ID; never
 *     `Number(value)`.
 *   - sum is `Decimal(15,3)` -> serialized as STRING (BigInt-as-string posture
 *     extends to Decimal per glucose-admin-api/CLAUDE.md).
 *   - data1..data10 are Text? — raw Kaspi callback fields, surfaced verbatim
 *     in the detail drawer (D-04).
 */

export interface KaspiPaymentRow {
    id: number;
    txn_id: string;            // BigInt-as-string
    txn_date: number | null;   // Unix seconds, nullable
    account: number;           // unsigned int (callable phone-like ID)
    sum: string;               // Decimal-as-string
    status: number | null;
}

export interface KaspiPaymentRelatedSale {
    id: number;
    buyer_id: number;
    webinar_id: number | null;
    created_at: number;
    total_amount: string | null;
}

export interface KaspiPaymentDetail extends KaspiPaymentRow {
    data1: string | null;
    data2: string | null;
    data3: string | null;
    data4: string | null;
    data5: string | null;
    data6: string | null;
    data7: string | null;
    data8: string | null;
    data9: string | null;
    data10: string | null;
    /** Sale rows that referenced this account / payment (best-effort match per D-04). */
    related_sales: KaspiPaymentRelatedSale[];
}

export interface KaspiPaymentListResponse {
    rows: KaspiPaymentRow[];
    total: number;
    page: number;
    page_size: number;
    next_cursor: string | null;
}

export type PaymentSortField = 'txn_date' | 'id' | 'sum';
export type PaymentSortOrder = 'asc' | 'desc';

export interface PaymentListQuery {
    page?: number;
    page_size?: number;
    /** Exact match (no enum on schema). */
    status?: number;
    /** Unix sec — txn_date >= date_from. */
    date_from?: number;
    /** Unix sec — txn_date < date_to (exclusive upper bound). */
    date_to?: number;
    /** Decimal-as-string. */
    amount_min?: string;
    /** Decimal-as-string. */
    amount_max?: string;
    /** Searches txn_id (string) OR account (Int) — server parses. */
    q?: string;
    sort?: PaymentSortField;
    order?: PaymentSortOrder;
    cursor?: string;
}

export interface PaymentExportInput {
    format: 'csv' | 'xlsx';
    status?: number;
    date_from?: number;
    date_to?: number;
    amount_min?: string;
    amount_max?: string;
    q?: string;
    sort?: PaymentSortField;
    order?: PaymentSortOrder;
}
