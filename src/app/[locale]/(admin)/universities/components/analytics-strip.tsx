'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Building2, GraduationCap, MapPin, Tractor, Shield, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAnalytics } from '@/lib/universities/api';

type Variant = 'universities' | 'specialties';

interface Props {
    variant: Variant;
}

/**
 * Phase 17 — compact stat-card strip mounted above the list pages.
 *
 * One query is shared across `universities` and `specialties` variants
 * (TanStack Query dedups on the key). Each variant renders the slice that
 * is relevant to the page it lives on.
 */
export function AnalyticsStrip({ variant }: Props) {
    const t = useTranslations('universities.analytics');

    const q = useQuery({
        queryKey: ['admin.universities.analytics'],
        queryFn: getAnalytics,
        staleTime: 5 * 60 * 1000,
    });

    if (q.isLoading) {
        return (
            <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className='p-4'>
                        <Skeleton className='mb-2 h-3 w-20' />
                        <Skeleton className='h-6 w-16' />
                    </Card>
                ))}
            </div>
        );
    }
    if (q.error || !q.data) return null;

    if (variant === 'universities') {
        const u = q.data.universities;
        return (
            <div className='space-y-3'>
                <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                    <StatCard icon={<Building2 className='size-4' />} label={t('universities_total')} value={u.total} />
                    <StatCard icon={<Home className='size-4' />} label={t('with_dormitory')} value={u.with_dormitory} hint={pct(u.with_dormitory, u.total)} />
                    <StatCard icon={<Shield className='size-4' />} label={t('with_military')} value={u.with_military_department} hint={pct(u.with_military_department, u.total)} />
                    <StatCard
                        icon={<GraduationCap className='size-4' />}
                        label={t('avg_specialties')}
                        value={u.avg_specialties_per_university.toFixed(1)}
                    />
                </div>
                <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
                    <Card className='p-4'>
                        <div className='mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground'>
                            <MapPin className='size-3' />
                            {t('top_cities')}
                        </div>
                        {u.top_cities.length === 0 ? (
                            <p className='text-sm text-muted-foreground'>{t('empty')}</p>
                        ) : (
                            <ul className='space-y-1.5 text-sm'>
                                {u.top_cities.map((c) => (
                                    <li key={c.city_id} className='flex items-center justify-between gap-2'>
                                        <span className='truncate'>{c.city_title_kk}</span>
                                        <Badge variant='secondary'>{c.university_count}</Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    <Card className='p-4'>
                        <div className='mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground'>
                            <GraduationCap className='size-3' />
                            {t('top_by_specialties')}
                        </div>
                        {u.top_by_specialty_count.length === 0 ? (
                            <p className='text-sm text-muted-foreground'>{t('empty')}</p>
                        ) : (
                            <ul className='space-y-1.5 text-sm'>
                                {u.top_by_specialty_count.map((row) => (
                                    <li key={row.id} className='flex items-center justify-between gap-2'>
                                        <span className='min-w-0 truncate'>
                                            <span className='font-mono text-xs text-muted-foreground'>{row.unik}</span>{' '}
                                            <span>{row.title_kk}</span>
                                        </span>
                                        <Badge variant='secondary'>{row.specialty_count}</Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>
        );
    }

    // specialties variant
    const s = q.data.specialties;
    const a = q.data.admission_stats;
    return (
        <div className='space-y-3'>
            <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                <StatCard icon={<GraduationCap className='size-4' />} label={t('specialties_total')} value={s.total} />
                <StatCard icon={<GraduationCap className='size-4' />} label={t('specialties_linked')} value={s.linked} hint={pct(s.linked, s.total)} />
                <StatCard icon={<Tractor className='size-4' />} label={t('rural_quota_links')} value={s.rural_quota_links} hint={`${s.rural_quota_share_pct}%`} />
                <StatCard
                    icon={<GraduationCap className='size-4' />}
                    label={t('admission_total')}
                    value={a.total}
                    hint={a.years_min !== null && a.years_max !== null ? `${a.years_min}–${a.years_max}` : undefined}
                />
            </div>
            <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
                <Card className='p-4'>
                    <div className='mb-2 text-xs font-medium uppercase text-muted-foreground'>
                        {t('top_offered')}
                    </div>
                    {s.top_offered.length === 0 ? (
                        <p className='text-sm text-muted-foreground'>{t('empty')}</p>
                    ) : (
                        <ul className='space-y-1.5 text-sm'>
                            {s.top_offered.map((sp) => (
                                <li key={sp.id} className='flex items-center justify-between gap-2'>
                                    <span className='min-w-0 truncate'>
                                        <span className='font-mono text-xs text-muted-foreground'>{sp.code}</span>{' '}
                                        <span>{sp.title_kk}</span>
                                    </span>
                                    <Badge variant='secondary'>{sp.university_count}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <Card className='p-4'>
                    <div className='mb-2 text-xs font-medium uppercase text-muted-foreground'>
                        {t('by_year')}
                    </div>
                    {a.by_year.length === 0 ? (
                        <p className='text-sm text-muted-foreground'>{t('empty')}</p>
                    ) : (
                        <ul className='space-y-1.5 text-sm'>
                            {a.by_year.slice(0, 6).map((row) => (
                                <li key={row.year} className='flex items-center justify-between gap-3'>
                                    <span className='font-mono text-xs'>{row.year}</span>
                                    <span className='flex flex-1 items-center justify-end gap-2 text-xs text-muted-foreground'>
                                        <span>
                                            {t('grants_total')}: <span className='font-medium text-foreground'>{row.total_grants}</span>
                                        </span>
                                        {row.avg_threshold !== null ? (
                                            <span>
                                                {t('avg_threshold')}: <span className='font-medium text-foreground'>{row.avg_threshold}</span>
                                            </span>
                                        ) : null}
                                    </span>
                                    <Badge variant='outline'>{row.stat_count}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    hint,
}: {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    hint?: string;
}) {
    return (
        <Card className='p-4'>
            <div className='mb-1 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground'>
                {icon}
                <span className='truncate'>{label}</span>
            </div>
            <div className='flex items-baseline gap-2'>
                <span className='text-2xl font-semibold tabular-nums'>{value}</span>
                {hint ? <span className='text-xs text-muted-foreground'>{hint}</span> : null}
            </div>
        </Card>
    );
}

function pct(part: number, whole: number): string {
    if (whole === 0) return '0%';
    return `${((part / whole) * 100).toFixed(0)}%`;
}
