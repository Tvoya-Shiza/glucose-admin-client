'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listTrainerThemes } from '@/lib/trainers/api';
import { TRAINER_PALETTE_SWATCHES } from '@/lib/trainers/theme-palettes';

/** Radix `<Select>` не принимает пустую строку — нужен явный маркер «без темы». */
const NONE = '__none__';

const THEMES_QUERY_KEY = ['admin.trainer-themes.list', { page_size: 200 }] as const;

export interface ThemeSelectProps {
    value: number | null;
    onChange: (id: number | null) => void;
    disabled?: boolean;
    className?: string;
}

/**
 * Выбор темы оформления тренажёра (phase-43).
 *
 * Тем немного, поэтому тянем весь список разом и кэшируем на минуту — как
 * SubjectSelect. В строке показываем миниатюру фона и образцы палитры: по
 * одному названию («Ғарыш») выбрать оформление вслепую нельзя.
 *
 * Скрытые темы (is_active=false) в списке остаются: если тренажёру назначена
 * скрытая тема, поле должно её показывать, а не молча сбрасываться в «без темы».
 */
export function ThemeSelect({ value, onChange, disabled, className }: ThemeSelectProps) {
    const t = useTranslations('admin.trainers');

    const { data, isLoading } = useQuery({
        queryKey: THEMES_QUERY_KEY,
        queryFn: () => listTrainerThemes({ page_size: 200 }),
        staleTime: 60_000,
    });

    const rows = data?.rows ?? [];

    return (
        <Select
            value={value == null ? NONE : String(value)}
            onValueChange={(next) => onChange(next === NONE ? null : Number(next))}
            disabled={disabled || isLoading}
        >
            <SelectTrigger className={className}>
                <SelectValue placeholder={t('field_theme_none')} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>{t('field_theme_none')}</SelectItem>
                {rows.map((row) => (
                    <SelectItem key={row.id} value={String(row.id)}>
                        <span className='flex items-center gap-2'>
                            {row.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={row.image} alt='' className='h-5 w-8 rounded object-cover' />
                            ) : null}
                            <span className='flex gap-0.5'>
                                {(TRAINER_PALETTE_SWATCHES[row.palette] ?? []).slice(0, 4).map((color) => (
                                    <span key={color} className='size-3 rounded-full ring-1 ring-black/10' style={{ backgroundColor: color }} />
                                ))}
                            </span>
                            {row.title}
                            {!row.is_active ? <span className='text-muted-foreground text-xs'>({t('themes_hidden')})</span> : null}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
