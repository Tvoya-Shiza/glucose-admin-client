'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { UploadKind } from '@/lib/uploads/types';

export interface FilesFiltersValue {
    kind?: UploadKind | null;
    q?: string | null;
    mine?: boolean | null;
}

export interface FilesFiltersProps {
    value: FilesFiltersValue;
    onChange: (next: FilesFiltersValue) => void;
}

/**
 * Kind/search/"mine" filter row for the file library page.
 *
 * Mirrors the layout of BannersFilters / BlogsFilters so the look is uniform
 * across admin list pages.
 */
export function FilesFilters({ value, onChange }: FilesFiltersProps) {
    const t = useTranslations('files');

    return (
        <div className='flex flex-wrap items-center gap-2 px-6 pb-4'>
            <Input
                placeholder={t('search_placeholder')}
                value={value.q ?? ''}
                onChange={(e) => onChange({ ...value, q: e.target.value || null })}
                className='w-64'
            />
            <Select
                value={value.kind ?? 'all'}
                onValueChange={(v) =>
                    onChange({ ...value, kind: v === 'all' ? null : (v as UploadKind) })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='all'>{t('filter_kind_all')}</SelectItem>
                    <SelectItem value='image'>{t('filter_kind_image')}</SelectItem>
                    <SelectItem value='cover'>{t('filter_kind_cover')}</SelectItem>
                    <SelectItem value='video'>{t('filter_kind_video')}</SelectItem>
                </SelectContent>
            </Select>
            <Button
                type='button'
                variant={value.mine ? 'default' : 'outline'}
                size='sm'
                onClick={() => onChange({ ...value, mine: value.mine ? null : true })}
            >
                {t('mine_toggle')}
            </Button>
        </div>
    );
}
