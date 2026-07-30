'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { STUDENT_ROLE_NAMES } from '@shared/roles';
import { listUsers } from '@/lib/users/api';
import type { UserRow } from '@/lib/users/types';

/**
 * Ученик в базе живёт под двумя именами роли: `user` (регистрация через
 * приложение) и `student` (импорт из админки). Фильтр только по `student`
 * прятал почти всех реальных учеников — на проде это 2 найденных из 18.
 */
const STUDENT_ROLES = [...STUDENT_ROLE_NAMES];

/**
 * Выбранный ученик. Подпись сохраняется в момент выбора, чтобы форма не
 * перезапрашивала имена для уже отмеченных (деталь урока отдаёт их вместе с
 * ограничениями).
 */
export interface StudentChip {
    id: number;
    label: string | null;
}

export interface MultiStudentPickerProps {
    value: StudentChip[];
    onChange: (next: StudentChip[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * Phase 44 — мультивыбор учеников для персонального доступа к уроку/разделу.
 *
 * Готового мультиселекта по пользователям не было: `UserPicker` одиночный.
 * Структура повторяет `MultiCoursePicker` (поиск с задержкой, чипы, крестик),
 * только источник — `listUsers` с фильтром по роли `student`, чтобы в список
 * не попадали преподаватели: им персональный доступ не нужен, они и так видят
 * содержимое курса.
 */
export function MultiStudentPicker({ value, onChange, placeholder, disabled }: MultiStudentPickerProps) {
    const t = useTranslations('admin.courses');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
        return () => clearTimeout(id);
    }, [searchQuery]);

    const list = useQuery({
        queryKey: ['admin.users.list', { q: debouncedQuery, page_size: 10, role_names: STUDENT_ROLES }],
        queryFn: () => listUsers({ q: debouncedQuery || undefined, page_size: 10, role_names: STUDENT_ROLES }),
        enabled: open && !disabled,
        staleTime: 30_000,
    });

    const selectedIds = useMemo(() => new Set(value.map((s) => s.id)), [value]);
    const candidates: UserRow[] = useMemo(
        () => (list.data?.rows ?? []).filter((u) => !selectedIds.has(u.id)),
        [list.data, selectedIds],
    );

    const labelOf = (u: UserRow) => u.full_name?.trim() || u.email?.trim() || u.mobile?.trim() || `#${u.id}`;

    const add = (user: UserRow) => {
        if (selectedIds.has(user.id)) return;
        onChange([...value, { id: user.id, label: labelOf(user) }]);
        setSearchQuery('');
        setOpen(false);
    };

    const remove = (id: number) => onChange(value.filter((s) => s.id !== id));

    return (
        <div className='space-y-2'>
            {value.length > 0 ? (
                <div className='flex flex-wrap gap-1.5'>
                    {value.map((s) => (
                        <Badge key={s.id} variant='secondary' className='gap-1 pr-1'>
                            <span className='max-w-[16rem] truncate'>{s.label ?? `#${s.id}`}</span>
                            {!disabled ? (
                                <button
                                    type='button'
                                    onClick={() => remove(s.id)}
                                    aria-label={t('student_remove')}
                                    className='hover:bg-muted-foreground/20 rounded-full p-0.5'
                                >
                                    <X className='h-3 w-3' />
                                </button>
                            ) : null}
                        </Badge>
                    ))}
                </div>
            ) : null}

            <div className='relative'>
                <Input
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!open) setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder={placeholder ?? t('students_search_placeholder')}
                    disabled={disabled}
                    autoComplete='off'
                />
                {open && !disabled ? (
                    <div className='bg-popover text-popover-foreground absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded border shadow-md'>
                        {list.isFetching ? (
                            <p className='text-muted-foreground p-3 text-xs'>{t('loading')}</p>
                        ) : candidates.length === 0 ? (
                            <p className='text-muted-foreground p-3 text-xs'>{t('students_no_results')}</p>
                        ) : (
                            candidates.map((u) => (
                                <button
                                    key={u.id}
                                    type='button'
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => add(u)}
                                    className='hover:bg-muted flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm'
                                >
                                    <span>{labelOf(u)}</span>
                                    {u.email && u.full_name ? (
                                        <span className='text-muted-foreground text-xs'>{u.email}</span>
                                    ) : null}
                                </button>
                            ))
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
