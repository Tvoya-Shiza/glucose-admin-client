'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AssignmentStatus } from '@/lib/assignments/types';

export interface AssignmentsFiltersValue {
    q?: string;
    status?: AssignmentStatus;
    webinar_id?: number;
}

export interface AssignmentsFiltersProps {
    value: AssignmentsFiltersValue;
    onChange: (next: AssignmentsFiltersValue) => void;
}

const ALL_VALUE = '__all__';

export function AssignmentsFilters({ value, onChange }: AssignmentsFiltersProps) {
    const t = useTranslations('admin.assignments');

    return (
        <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
            <div className='space-y-1.5'>
                <Label>{t('search_placeholder')}</Label>
                <Input
                    value={value.q ?? ''}
                    onChange={(e) => onChange({ ...value, q: e.target.value.length > 0 ? e.target.value : undefined })}
                    placeholder={t('search_placeholder')}
                />
            </div>
            <div className='space-y-1.5'>
                <Label>{t('filter_status')}</Label>
                <Select
                    value={value.status ?? ALL_VALUE}
                    onValueChange={(v) =>
                        onChange({ ...value, status: v === ALL_VALUE ? undefined : (v as AssignmentStatus) })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_VALUE}>{t('filter_all')}</SelectItem>
                        <SelectItem value='active'>{t('status_active')}</SelectItem>
                        <SelectItem value='inactive'>{t('status_inactive')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className='space-y-1.5'>
                <Label>{t('filter_webinar')}</Label>
                <Input
                    type='number'
                    min={1}
                    value={value.webinar_id ?? ''}
                    onChange={(e) => {
                        const n = e.target.value.length > 0 ? Number(e.target.value) : undefined;
                        onChange({ ...value, webinar_id: Number.isFinite(n) ? n : undefined });
                    }}
                    placeholder='ID'
                />
            </div>
        </div>
    );
}
