/**
 * Phase 7 Plan 01 — shared promocodes types.
 *
 * Schema reference (glucose-admin-api/prisma/schema.prisma lines 1388-1432):
 *   - Promocode: id (Int, autoincrement), code (unique varchar), title?, description?,
 *     discount_type (varchar 'percentage'|'fixed'), discount_value (Decimal(10,2)),
 *     max_discount_amount? (Decimal(15,2)), minimum_order_amount? (Decimal(15,2)),
 *     usage_limit? (Int), usage_limit_per_user? (Int), is_active (Boolean),
 *     start_date (UnsignedInt unix), expires_at (UnsignedInt unix), creator_id,
 *     region_id?, applicable_to (Json?), excluded_items (Json?),
 *     first_purchase_only (Boolean default false), created_at, updated_at.
 *   - PromocodeUsage: id, promocode_id, user_id, order_id,
 *     discount_amount? (Decimal(8,2)), order_amount? (Decimal(8,2)), used_at (Int unix).
 *
 * SCHEMA-TRUTH LOCK:
 *   - There is NO `scope` enum and NO `course_id` column. D-13's "scope (course/global)"
 *     must be encoded in the `applicable_to` JSON column, shape:
 *       { type: 'global' } | { type: 'course'; course_ids: number[] }
 *   - Decimal columns are serialized as string by admin-api (BigInt-as-string posture
 *     extends to Decimal — admin-client treats them as opaque numeric strings, never
 *     calls Number() on them).
 *   - `code` has a unique constraint — Plan 05 must surface a "code already exists"
 *     toast on conflict (P2002).
 *   - PromocodeUsage decimals are nullable (`discount_amount?`, `order_amount?`).
 */
export type DiscountType = 'percentage' | 'fixed';

export type PromocodeApplicableTo =
    | { type: 'global' }
    | { type: 'course'; course_ids: number[] };

export interface PromocodeRow {
    id: number;
    code: string;
    title: string | null;
    discount_type: DiscountType;
    /** Decimal(10,2) on the schema → serialized as string. */
    discount_value: string;
    is_active: boolean;
    start_date: number;
    expires_at: number;
    usage_limit: number | null;
    /** Server-computed via Prisma _count.usages. */
    usage_count: number;
    created_at: number;
}

export interface PromocodeDetail extends PromocodeRow {
    description: string | null;
    /** Decimal(15,2) on the schema → serialized as string. */
    max_discount_amount: string | null;
    /** Decimal(15,2) on the schema → serialized as string. */
    minimum_order_amount: string | null;
    usage_limit_per_user: number | null;
    applicable_to: PromocodeApplicableTo | null;
    /** JSON column; opaque to admin-client until Plan 09 sales reporting needs it. */
    excluded_items: unknown | null;
    first_purchase_only: boolean;
    region_id: number | null;
    creator_id: number;
    updated_at: number;
}

export interface PromocodeUpsertInput {
    code: string;
    title?: string | null;
    description?: string | null;
    discount_type: DiscountType;
    discount_value: string;
    max_discount_amount?: string | null;
    minimum_order_amount?: string | null;
    usage_limit?: number | null;
    usage_limit_per_user?: number | null;
    is_active: boolean;
    start_date: number;
    expires_at: number;
    applicable_to?: PromocodeApplicableTo | null;
    first_purchase_only?: boolean;
    region_id?: number | null;
}

export interface PromocodeListResponse {
    rows: PromocodeRow[];
    total: number;
    pageCount: number;
}

export interface PromocodeUsageRow {
    id: number;
    promocode_id: number;
    user_id: number;
    user_full_name: string | null;
    user_email: string | null;
    order_id: number;
    /** Decimal(8,2) → string (nullable on schema). */
    discount_amount: string | null;
    /** Decimal(8,2) → string (nullable on schema). */
    order_amount: string | null;
    used_at: number;
}

export interface PromocodeUsageListResponse {
    rows: PromocodeUsageRow[];
    total: number;
    pageCount: number;
}
