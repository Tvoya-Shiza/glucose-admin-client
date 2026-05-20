/**
 * Phase 17 — Universities & Specialties domain types.
 *
 * Snapshot copies (not shared-types) since these models are new in glucose-api.
 * Update by hand if/when the backend shape changes.
 */

export interface UniversityListRow {
    id: number;
    unik: string;
    title_kk: string;
    city_id: number | null;
    city_title_kk: string | null;
    has_dormitory: boolean;
    has_military_department: boolean;
    website: string | null;
    phone: string | null;
    email: string | null;
    specialty_count: number;
    created_at: number;
    updated_at: number | null;
}

export interface UniversityListResponse {
    rows: UniversityListRow[];
    total: number;
    pageCount: number;
}

export interface ListUniversitiesQuery {
    page?: number;
    page_size?: number;
    q?: string;
    city_id?: number;
    has_dormitory?: boolean;
    has_military_department?: boolean;
    sort?: 'title_kk' | 'unik' | 'created_at' | 'updated_at';
    order?: 'asc' | 'desc';
}

export interface UniversityDetail {
    id: number;
    unik: string;
    city_id: number | null;
    city_title_kk: string | null;
    website: string | null;
    phone: string | null;
    email: string | null;
    instagram: string | null;
    address: string | null;
    has_dormitory: boolean;
    has_military_department: boolean;
    title_kk: string;
    short_desc_kk: string | null;
    full_desc_kk: string | null;
    icon_asset_id: string | null;
    image_asset_id: string | null;
    specialty_count: number;
    created_at: number;
    updated_at: number | null;
}

export interface UpsertUniversityPayload {
    unik?: string;
    city_id?: number | null;
    website?: string | null;
    phone?: string | null;
    email?: string | null;
    instagram?: string | null;
    address?: string | null;
    has_dormitory?: boolean;
    has_military_department?: boolean;
    title_kk?: string;
    short_desc_kk?: string | null;
    full_desc_kk?: string | null;
    icon_asset_id?: string | null;
    image_asset_id?: string | null;
}

export interface SpecialtyListRow {
    id: number;
    code: string;
    title_kk: string;
    university_count: number;
    created_at: number;
    updated_at: number | null;
}

export interface SpecialtyListResponse {
    rows: SpecialtyListRow[];
    total: number;
    pageCount: number;
}

export interface ListSpecialtiesQuery {
    page?: number;
    page_size?: number;
    q?: string;
    sort?: 'title_kk' | 'code' | 'created_at';
    order?: 'asc' | 'desc';
}

export interface UpsertSpecialtyPayload {
    code?: string;
    title_kk?: string;
}

export interface UniversitySpecialtyRow {
    id: number;
    university_id: number;
    specialty_id: number;
    specialty_code: string;
    specialty_title_kk: string;
    has_rural_quota: boolean;
    short_desc_kk: string | null;
    full_desc_kk: string | null;
    admission_stats_count: number;
    created_at: number;
    updated_at: number | null;
}

export interface UpsertUniversitySpecialtyPayload {
    specialty_id?: number;
    has_rural_quota?: boolean;
    short_desc_kk?: string | null;
    full_desc_kk?: string | null;
}

export interface AdmissionStatRow {
    id: number;
    university_specialty_id: number;
    university_id: number;
    university_unik: string;
    specialty_id: number;
    specialty_code: string;
    year: number;
    grants_count: number | null;
    threshold: number | null;
    threshold_rural: number | null;
    created_at: number;
    updated_at: number | null;
}

export interface AdmissionStatListResponse {
    rows: AdmissionStatRow[];
    total: number;
    pageCount: number;
}

export interface ListAdmissionStatsQuery {
    page?: number;
    page_size?: number;
    university_id?: number;
    specialty_id?: number;
    year?: number;
}

export interface UpsertAdmissionStatPayload {
    university_specialty_id?: number;
    year?: number;
    grants_count?: number | null;
    threshold?: number | null;
    threshold_rural?: number | null;
}

// ----- import/export -----

export type ImportKind = 'universities' | 'specialties' | 'admission_stats';

export interface ImportResultRow {
    row_id: string;
    row_index: number;
    status: 'insert' | 'update' | 'skip' | 'error';
    reason: string | null;
    entity_id: number | null;
}

export interface ImportResult {
    kind: ImportKind;
    bulk_op_id: string;
    mode: 'dry_run' | 'commit';
    affected: number;
    insert: number;
    update: number;
    skip: number;
    error: number;
    rows: ImportResultRow[];
}

// ----- analytics -----

export interface AnalyticsUniversitiesBlock {
    total: number;
    with_dormitory: number;
    with_military_department: number;
    with_city: number;
    without_city: number;
    avg_specialties_per_university: number;
    top_cities: Array<{ city_id: number; city_title_kk: string; university_count: number }>;
    top_by_specialty_count: Array<{ id: number; unik: string; title_kk: string; specialty_count: number }>;
}

export interface AnalyticsSpecialtiesBlock {
    total: number;
    linked: number;
    unlinked: number;
    rural_quota_links: number;
    rural_quota_share_pct: number;
    top_offered: Array<{ id: number; code: string; title_kk: string; university_count: number }>;
}

export interface AnalyticsAdmissionYearRow {
    year: number;
    stat_count: number;
    total_grants: number;
    avg_threshold: number | null;
    avg_threshold_rural: number | null;
}

export interface AnalyticsAdmissionBlock {
    total: number;
    distinct_years: number;
    years_min: number | null;
    years_max: number | null;
    by_year: AnalyticsAdmissionYearRow[];
    avg_grants_per_record: number | null;
}

export interface AnalyticsResponse {
    universities: AnalyticsUniversitiesBlock;
    specialties: AnalyticsSpecialtiesBlock;
    admission_stats: AnalyticsAdmissionBlock;
    generated_at: number;
}
