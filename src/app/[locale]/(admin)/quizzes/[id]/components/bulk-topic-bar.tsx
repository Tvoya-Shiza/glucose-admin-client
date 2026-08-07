'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { assignQuestionsTopic, listQuizTopics } from '@/lib/quizzes/api';
import { TOPIC_NONE, childTopicsOf, resolveTopicId, rootTopicsOf } from '@/lib/quizzes/topic-selection';

interface BulkTopicBarProps {
    quizId: number;
    selectedIds: number[];
    onDone: () => void;
    onClear: () => void;
}

/**
 * Панель массовой простановки темы (phase-55).
 *
 * Появляется, только когда что-то выбрано. Нужна потому, что размечать
 * существующие вопросы по одному нереально: на момент написания тема стояла у
 * одного вопроса из 1051, а без разметки разбор результата по темам пуст.
 *
 * Выбор темы — те же два селекта «тема + подтема», что и в форме вопроса, и та
 * же логика из `topic-selection.ts`: в базу уходит самый конкретный выбранный
 * уровень. Дублировать разбор граничных случаев (тема-сирота, архивная тема)
 * во втором месте незачем.
 */
export function BulkTopicBar({ quizId, selectedIds, onDone, onClear }: BulkTopicBarProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    const topicsQuery = useQuery({
        queryKey: ['admin.quiz-topics.list'],
        queryFn: () => listQuizTopics(),
        staleTime: 5 * 60 * 1000,
    });

    const [parent, setParent] = useState<string>(TOPIC_NONE);
    const [child, setChild] = useState<string>(TOPIC_NONE);

    const allTopics = topicsQuery.data ?? [];
    const roots = rootTopicsOf(allTopics);
    const children = childTopicsOf(allTopics, parent);

    const mutation = useMutation({
        mutationFn: () => assignQuestionsTopic(quizId, selectedIds, resolveTopicId(parent, child)),
        onSuccess: (res) => {
            toast.success(t('bulk_topic.done', { count: res.affected }));
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            onDone();
        },
        onError: (err: Error) => toast.error(err.message || t('save_failed')),
    });

    return (
        <div className='bg-muted/40 flex flex-wrap items-end gap-3 rounded-lg border p-3'>
            <div className='text-sm font-medium'>{t('bulk_topic.selected', { count: selectedIds.length })}</div>

            <div className='min-w-44 flex-1 space-y-1'>
                <label className='text-muted-foreground text-xs'>{t('question_topic_label')}</label>
                <Select
                    value={parent}
                    onValueChange={(v) => {
                        setParent(v);
                        // Смена родителя сбрасывает подтему: оставить прежнюю
                        // значило бы проставить подтему чужого родителя.
                        setChild(TOPIC_NONE);
                    }}
                >
                    <SelectTrigger className='w-full'>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={TOPIC_NONE}>{t('question_topic_none')}</SelectItem>
                        {roots.map((topic) => (
                            <SelectItem key={topic.id} value={String(topic.id)}>
                                {topic.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className='min-w-44 flex-1 space-y-1'>
                <label className='text-muted-foreground text-xs'>{t('question_subtopic_label')}</label>
                <Select value={child} onValueChange={setChild} disabled={children.length === 0}>
                    <SelectTrigger className='w-full'>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={TOPIC_NONE}>{t('question_subtopic_all')}</SelectItem>
                        {children.map((topic) => (
                            <SelectItem key={topic.id} value={String(topic.id)}>
                                {topic.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Button type='button' size='sm' onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {t('bulk_topic.apply')}
            </Button>
            <Button type='button' size='sm' variant='ghost' onClick={onClear}>
                {t('bulk_topic.clear')}
            </Button>
        </div>
    );
}
