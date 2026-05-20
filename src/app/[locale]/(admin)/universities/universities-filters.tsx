'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface UniversitiesFiltersValue {
    q?: string;
    has_dormitory?: boolean;
    has_military_department?: boolean;
}

interface Props {
    value: UniversitiesFiltersValue;
    onChange: (next: UniversitiesFiltersValue) => void;
}

const ALL = '__all__';
const YES = 'y';
const NO = 'n';

function ynToBool(v: string): boolean | undefined {
    if (v === YES) return true;
    if (v === NO) return false;
    return undefined;
}
function boolToYn(v: boolean | undefined): string {
    if (v === true) return YES;
    if (v === false) return NO;
    return ALL;
}

export function UniversitiesFilters({ value, onChange }: Props) {
    const t = useTranslations('universities');
    const [qLocal, setQLocal] = useState(value.q ?? '');

    useEffect(() => {
        const id = setTimeout(() => {
            if ((value.q ?? '') !== qLocal) {
                onChange({ ...value, q: qLocal || undefined });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qLocal]);

    return (
        <div className='flex flex-wrap items-center gap-3'>
            <Input
                className='max-w-sm'
                placeholder={t('search_placeholder')}
                value={qLocal}
                onChange={(e) => setQLocal(e.target.value)}
            />
            <Select
                value={boolToYn(value.has_dormitory)}
                onValueChange={(v) => onChange({ ...value, has_dormitory: ynToBool(v) })}
            >
                <SelectTrigger className='w-[180px]'>
                    <SelectValue placeholder={t('filter_dormitory')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>{t('filter_all')}</SelectItem>
                    <SelectItem value={YES}>{t('has_dormitory_yes')}</SelectItem>
                    <SelectItem value={NO}>{t('has_dormitory_no')}</SelectItem>
                </SelectContent>
            </Select>
            <Select
                value={boolToYn(value.has_military_department)}
                onValueChange={(v) => onChange({ ...value, has_military_department: ynToBool(v) })}
            >
                <SelectTrigger className='w-[200px]'>
                    <SelectValue placeholder={t('filter_military')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>{t('filter_all')}</SelectItem>
                    <SelectItem value={YES}>{t('has_military_yes')}</SelectItem>
                    <SelectItem value={NO}>{t('has_military_no')}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
