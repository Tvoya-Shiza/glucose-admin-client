'use client';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { useAudiencePreview } from '@/lib/audience/use-audience-preview';
import type { AudienceShape } from '@/lib/audience/types';

interface Props {
    audience: AudienceShape;
}

/**
 * Phase 8 Plan 02 — server-computed audience preview (D-02).
 *
 * Subscribes via useAudiencePreview() — POST /api/proxy/v1/admin/push/audience-preview
 * with 400ms debounce + 30s staleTime. Renders count + sample (up to 5 names) +
 * a "cache" badge when the server hit its 30s Redis cache.
 *
 * States:
 *   - audience has no filters     → "Select at least one filter"
 *   - request in flight           → "Computing audience..."
 *   - request errored             → "Failed to compute audience: <message>"
 *   - count = 0                   → "No recipients match these filters"
 *   - count > 0                   → "Recipients: N" + sample names + cache badge
 *
 * Usage:
 *   <AudienceSelector value={audience} onChange={setAudience} />
 *   <AudiencePreview audience={audience} />
 */
export function AudiencePreview({ audience }: Props) {
    const t = useTranslations('admin.audience');
    const { data, isLoading, isError, error, debouncedAudience } = useAudiencePreview(audience);

    const empty = !debouncedAudience || debouncedAudience.filters.length === 0;

    if (empty) {
        return <p className='text-sm text-muted-foreground'>{t('required_audience')}</p>;
    }
    if (isLoading) {
        return <p className='text-sm text-muted-foreground'>{t('preview_loading')}</p>;
    }
    if (isError) {
        return (
            <p className='text-sm text-destructive'>
                {t('preview_error')}: {(error as Error).message}
            </p>
        );
    }
    if (!data) return null;

    return (
        <div className='flex flex-col gap-1 rounded-md border p-3 text-sm'>
            <div className='flex items-center gap-2'>
                {data.count === 0 ? (
                    <span className='text-muted-foreground'>{t('preview_count_zero')}</span>
                ) : (
                    <span>{t('preview_count', { count: data.count })}</span>
                )}
                {data.cached && <Badge variant='secondary'>cache</Badge>}
            </div>
            {data.sample.length > 0 && (
                <div className='text-muted-foreground'>
                    {t('preview_sample', {
                        names: data.sample.map((s) => s.full_name ?? s.email ?? `#${s.id}`).join(', '),
                    })}
                </div>
            )}
        </div>
    );
}
