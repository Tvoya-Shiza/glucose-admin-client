'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { toast } from 'sonner';
import { FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/lib/access/use-permission';
import { createQuizPassage, deleteQuizPassage, listQuizPassages, updateQuizPassage } from '@/lib/quizzes/api';
import type { QuizPassage } from '@/lib/quizzes/types';
import { TiptapEditor } from '../../courses/[id]/components/tiptap-editor';

const PER_PAGE = 20;

/**
 * Справочник контекстов (phase-53).
 *
 * Заказчик: «контекст отдельно (название для поиска и сам текст) … и внутри
 * поиск по названию».
 *
 * Справочник ГЛОБАЛЬНЫЙ: один контекст подставляется в разные тесты. Название —
 * внутренняя подпись методиста, ученику оно не уходит; на экране у ученика над
 * вопросом стоит только сам текст.
 */
export function QuizPassagesClient() {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();
    const canEdit = usePermission('quizzes.edit');

    const [{ q, page }, setQuery] = useQueryStates({
        q: parseAsString.withDefault(''),
        page: parseAsInteger.withDefault(1),
    });

    // Поиск не бьёт в сеть на каждую букву: справочник листается человеком,
    // а не машиной, и 300 мс задержки незаметны.
    const [draft, setDraft] = useState(q);
    useEffect(() => {
        const id = setTimeout(() => {
            if (draft !== q) void setQuery({ q: draft || null, page: 1 });
        }, 300);
        return () => clearTimeout(id);
    }, [draft, q, setQuery]);

    const queryKey = ['admin.quiz-passages.list', { q, page }] as const;
    const { data, isLoading } = useQuery({
        queryKey,
        queryFn: () => listQuizPassages({ q, page, per_page: PER_PAGE }),
    });

    const [editing, setEditing] = useState<QuizPassage | null>(null);
    const [creating, setCreating] = useState(false);

    const invalidate = () => qc.invalidateQueries({ queryKey: ['admin.quiz-passages.list'] });

    const removeMutation = useMutation({
        mutationFn: (id: number) => deleteQuizPassage(id),
        onSuccess: () => {
            toast.success(t('passage_deleted'));
            void invalidate();
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : t('generic_error')),
    });

    const rows = data?.passages ?? [];

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('passages_page_title')}
                    subtitle={t('passages_page_subtitle')}
                    actions={
                        canEdit ? (
                            <Button size='sm' onClick={() => setCreating(true)}>
                                <Plus className='mr-2 h-4 w-4' />
                                {t('passage_add')}
                            </Button>
                        ) : null
                    }
                />
            }
        >
            <div className='relative'>
                <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t('passage_search_placeholder')}
                    className='pl-9'
                    maxLength={255}
                />
            </div>

            {isLoading ? (
                <Card className='space-y-2 p-4'>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className='h-12 w-full' />
                    ))}
                </Card>
            ) : rows.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title={q ? t('passages_no_search_results', { query: q }) : t('passages_empty')}
                    subtitle={q ? undefined : t('passages_empty_hint')}
                />
            ) : (
                <Card className='divide-y'>
                    {rows.map((row) => (
                        <div key={row.id} className='flex items-center gap-2 p-3'>
                            <FileText className='text-muted-foreground h-4 w-4 shrink-0' />
                            <div className='min-w-0 flex-1'>
                                <p className='truncate text-sm font-medium'>{row.title || t('passage_untitled')}</p>
                                <p className='text-muted-foreground truncate text-xs'>{plainPreview(row.body)}</p>
                            </div>
                            {/* Использования показаны всегда: удалить занятый
                                контекст нельзя, и причину лучше видеть заранее,
                                чем ловить 409. */}
                            <Badge variant='outline' className='shrink-0 text-xs'>
                                {t('passage_usage', { questions: row.question_count, quizzes: row.quiz_count })}
                            </Badge>
                            {canEdit ? (
                                <>
                                    <Button variant='ghost' size='sm' onClick={() => setEditing(row)}>
                                        <Pencil className='h-4 w-4' />
                                    </Button>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        disabled={removeMutation.isPending}
                                        onClick={() => {
                                            if (row.question_count > 0) {
                                                toast.error(
                                                    t('passage_in_use', {
                                                        questions: row.question_count,
                                                        quizzes: row.quiz_count,
                                                    }),
                                                );
                                                return;
                                            }
                                            removeMutation.mutate(row.id);
                                        }}
                                    >
                                        <Trash2 className='text-destructive h-4 w-4' />
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    ))}
                </Card>
            )}

            {(data?.pageCount ?? 1) > 1 ? (
                <div className='flex items-center justify-between'>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={page <= 1}
                        onClick={() => void setQuery({ page: page - 1 })}
                    >
                        {t('prev')}
                    </Button>
                    <span className='text-muted-foreground text-sm'>
                        {page} / {data?.pageCount ?? 1}
                    </span>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={page >= (data?.pageCount ?? 1)}
                        onClick={() => void setQuery({ page: page + 1 })}
                    >
                        {t('next')}
                    </Button>
                </div>
            ) : null}

            <PassageDialog
                open={creating || editing !== null}
                passage={editing}
                onClose={() => {
                    setCreating(false);
                    setEditing(null);
                }}
                onSaved={() => void invalidate()}
            />
        </PageShell>
    );
}

/** Первая строка текста без разметки — чтобы отличить контексты в списке. */
function plainPreview(html: string): string {
    const text = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

interface PassageDialogProps {
    open: boolean;
    /** null — создание; иначе правка. */
    passage: QuizPassage | null;
    onClose: () => void;
    onSaved: () => void;
}

function PassageDialog({ open, passage, onClose, onSaved }: PassageDialogProps) {
    const t = useTranslations('admin.quizzes');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [seeded, setSeeded] = useState<number | 'new' | undefined>(undefined);

    // Сеем поля один раз на открытие: правка в useEffect на каждый рендер
    // затирала бы то, что методист уже набрал.
    const seedKey = passage ? passage.id : 'new';
    if (open && seeded !== seedKey) {
        setSeeded(seedKey);
        setTitle(passage?.title ?? '');
        setBody(passage?.body ?? '');
    }
    if (!open && seeded !== undefined) setSeeded(undefined);

    const saveMutation = useMutation({
        mutationFn: () =>
            passage
                ? updateQuizPassage(passage.id, { title: title.trim() || null, body })
                : createQuizPassage({ title: title.trim() || null, body }),
        onSuccess: () => {
            toast.success(passage ? t('passage_updated') : t('passage_created'));
            onSaved();
            onClose();
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : t('generic_error')),
    });

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
            <DialogContent className='max-w-3xl'>
                <DialogHeader>
                    <DialogTitle>{passage ? t('passage_edit_title') : t('passage_create_title')}</DialogTitle>
                    <DialogDescription>{t('passage_title_hint')}</DialogDescription>
                </DialogHeader>

                <div className='space-y-4'>
                    <div className='space-y-1'>
                        <Label htmlFor='passage-title'>{t('passage_title_label')}</Label>
                        <Input
                            id='passage-title'
                            autoFocus
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={255}
                        />
                    </div>
                    <div className='space-y-1'>
                        <Label>{t('passage_body_label')}</Label>
                        {/* Редактор монтируется по ключу записи: иначе при
                            переходе «правка A → правка B» Tiptap сохранил бы
                            содержимое предыдущего контекста. */}
                        <TiptapEditor key={seedKey} initialHtml={body} onChange={setBody} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant='outline' onClick={onClose}>
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={plainPreview(body).length === 0 || saveMutation.isPending}
                    >
                        {t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
