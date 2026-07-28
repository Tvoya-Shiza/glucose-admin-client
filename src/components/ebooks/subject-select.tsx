'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermission } from '@/lib/access/use-permission';
import { createQuizSubject, listQuizSubjects } from '@/lib/ebooks/api';
import type { QuizSubjectListResponse } from '@/lib/ebooks/types';

/** Sentinel for "no subject" — Radix `<Select>` rejects empty-string values. */
const NONE = '__none__';

const SUBJECTS_QUERY_KEY = ['admin.quiz-subjects.list', { page_size: 200 }] as const;

export interface SubjectSelectProps {
    value: number | null;
    onChange: (id: number | null) => void;
    /** Copy for the "no subject / all subjects" row. */
    noneLabel?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    /** Показать поле «добавить предмет» под списком (форма книги — да, фильтр — нет). */
    allowCreate?: boolean;
    /**
     * Право, дающее инлайновое создание. Справочник предметов общий для книг и
     * тренажёров, а группы прав у них разные — поэтому право приходит снаружи,
     * а не зашито в компонент.
     */
    createPermission?: string;
}

/**
 * Выбор предмета (ТЗ 3.2.2, 6.0 — «список предметов настраивается администратором»).
 *
 * До этого предмет книги задавался сырым числовым id: эндпоинта предметов не
 * существовало, и оператор должен был знать id наизусть. Теперь список приходит
 * из GET /quiz-subjects — предметов десятки, поэтому тянем весь список разом
 * (page_size=200, серверный потолок) и кэшируем на минуту, как PublisherSelect.
 *
 * `allowCreate` добавляет инлайновое создание: справочник общий с тестами, и
 * заводить новый предмет ради книги приходится там же, где заполняешь карточку.
 */
export function SubjectSelect({
    value,
    onChange,
    noneLabel,
    placeholder,
    disabled,
    className,
    allowCreate = false,
    createPermission = 'ebooks.edit',
}: SubjectSelectProps) {
    const t = useTranslations('admin.ebooks');
    const qc = useQueryClient();
    const canEdit = usePermission(createPermission);
    const [draft, setDraft] = useState('');
    /**
     * Только что созданный предмет, который надо выбрать. Выбрать его сразу в
     * onSuccess нельзя: Radix `<Select>` игнорирует значение, если опция с ним
     * появляется в том же коммите — поле оставалось пустым. Поэтому выбираем в
     * эффекте, когда опция уже отрисована (см. ниже).
     */
    const [pendingId, setPendingId] = useState<number | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: SUBJECTS_QUERY_KEY,
        queryFn: () => listQuizSubjects({ page: 1, page_size: 200 }),
        enabled: !disabled,
        staleTime: 60_000,
    });

    const createMut = useMutation({
        mutationFn: (title: string) => createQuizSubject({ title }),
        onSuccess: (created) => {
            setDraft('');
            toast.success(t('subject_created', { title: created.title }));
            /*
             * Строку кладём в кэш до onChange: Radix `<Select>` не отрисует значение,
             * которого нет среди опций, и до прихода перезапроса поле выглядело бы
             * пустым — как будто предмет не создался.
             */
            qc.setQueryData<QuizSubjectListResponse>(SUBJECTS_QUERY_KEY, (prev) =>
                prev
                    ? {
                          ...prev,
                          rows: [...prev.rows, { ...created, book_count: 0, quiz_count: 0, created_at: null, updated_at: null }].sort(
                              (a, b) => a.title.localeCompare(b.title, 'kk')
                          ),
                          total: prev.total + 1,
                      }
                    : prev
            );
            setPendingId(created.id);
            qc.invalidateQueries({ queryKey: SUBJECTS_QUERY_KEY });
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : t('generic_error')),
    });

    const rows = data?.rows ?? [];
    const trimmed = draft.trim();

    useEffect(() => {
        if (pendingId == null) return;
        if (!rows.some((s) => s.id === pendingId)) return;
        onChange(pendingId);
        setPendingId(null);
        // onChange пересоздаётся на каждом рендере родителя — в зависимостях он
        // гонял бы эффект вхолостую; достаточно реагировать на появление опции.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingId, rows]);

    return (
        <div className='space-y-2'>
            <Select
                value={value == null ? NONE : String(value)}
                onValueChange={(v) => onChange(v === NONE ? null : Number(v))}
                disabled={disabled}
            >
                <SelectTrigger className={className}>
                    <SelectValue placeholder={placeholder ?? t('subject_label')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE}>{noneLabel ?? t('filter_all')}</SelectItem>
                    {isLoading ? (
                        <SelectItem value='__loading__' disabled>
                            {t('loading')}
                        </SelectItem>
                    ) : null}
                    {rows.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                            {s.title}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {allowCreate && canEdit && !disabled ? (
                <div className='flex gap-2'>
                    <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={t('subject_create_placeholder')}
                        maxLength={255}
                        onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            // Иначе Enter отправил бы форму книги вместо создания предмета.
                            e.preventDefault();
                            if (trimmed.length > 0 && !createMut.isPending) createMut.mutate(trimmed);
                        }}
                    />
                    <Button
                        type='button'
                        variant='outline'
                        disabled={trimmed.length === 0 || createMut.isPending}
                        onClick={() => createMut.mutate(trimmed)}
                    >
                        {t('subject_create')}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
