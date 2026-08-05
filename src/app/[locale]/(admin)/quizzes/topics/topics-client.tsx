'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ChevronRight, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/lib/access/use-permission';
import { createQuizTopic, deleteQuizTopic, listQuizTopics, updateQuizTopic } from '@/lib/quizzes/api';
import type { QuizTopicNode } from '@/lib/quizzes/types';

const QUERY_KEY = ['admin.quiz-topics.list'] as const;
const ROOT_VALUE = '__root__';

/**
 * Справочник тем тестов (phase-51).
 *
 * Заказчик просил его ради разбора результата по темам: без справочника у
 * вопроса нечего проставить, а у ученика нечего показать.
 *
 * Дерево рисуется отступами по глубине, а не вложенными списками: тем немного
 * (это разделы предмета, а не каталог), и плоский список с отступом читается
 * лучше, чем вложенные карточки, — видно все темы разом.
 */
export function QuizTopicsClient() {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();
    const canEdit = usePermission('quizzes.edit');

    const { data: topics, isLoading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: () => listQuizTopics(),
    });

    const [editing, setEditing] = useState<QuizTopicNode | null>(null);
    const [creatingUnder, setCreatingUnder] = useState<number | null | undefined>(undefined);

    /**
     * Плоский список → порядок обхода дерева с глубиной. Сирота (родитель
     * заархивирован и не пришёл в выдаче) не должна исчезать с экрана — иначе
     * её нельзя ни переименовать, ни перенести; поэтому такие узлы показываем
     * на верхнем уровне.
     */
    const ordered = useMemo(() => {
        const rows = topics ?? [];
        const byParent = new Map<number | null, QuizTopicNode[]>();
        const known = new Set(rows.map((r) => r.id));
        for (const row of rows) {
            const key = row.parent_id != null && known.has(row.parent_id) ? row.parent_id : null;
            const list = byParent.get(key) ?? [];
            list.push(row);
            byParent.set(key, list);
        }
        const out: Array<{ node: QuizTopicNode; depth: number }> = [];
        const walk = (parent: number | null, depth: number) => {
            for (const node of byParent.get(parent) ?? []) {
                out.push({ node, depth });
                walk(node.id, depth + 1);
            }
        };
        walk(null, 0);
        return out;
    }, [topics]);

    const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });
    const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : t('generic_error'));

    const removeMutation = useMutation({
        mutationFn: (id: number) => deleteQuizTopic(id),
        onSuccess: () => {
            toast.success(t('topic_deleted'));
            void invalidate();
        },
        onError,
    });

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('topics_page_title')}
                    subtitle={t('topics_page_subtitle')}
                    actions={
                        canEdit ? (
                            <Button size='sm' onClick={() => setCreatingUnder(null)}>
                                <Plus className='mr-2 h-4 w-4' />
                                {t('topic_add')}
                            </Button>
                        ) : null
                    }
                />
            }
        >
            {isLoading ? (
                <Card className='space-y-2 p-4'>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className='h-10 w-full' />
                    ))}
                </Card>
            ) : ordered.length === 0 ? (
                <EmptyState icon={FolderTree} title={t('topics_empty')} subtitle={t('topics_empty_hint')} />
            ) : (
                <Card className='divide-y'>
                    {ordered.map(({ node, depth }) => (
                        <div
                            key={node.id}
                            className='flex items-center gap-2 p-3'
                            style={{ paddingLeft: `${12 + depth * 24}px` }}
                        >
                            {depth > 0 ? <ChevronRight className='text-muted-foreground h-4 w-4 shrink-0' /> : null}
                            <span className='min-w-0 flex-1 truncate text-sm font-medium'>{node.name}</span>
                            {/* Число вопросов показано всегда: удалить тему с вопросами
                                нельзя, и лучше увидеть причину заранее, чем в 409. */}
                            <Badge variant='outline' className='shrink-0 text-xs'>
                                {t('topic_question_count', { count: node.question_count })}
                            </Badge>
                            {canEdit ? (
                                <>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => setCreatingUnder(node.id)}
                                        title={t('topic_add_child')}
                                    >
                                        <Plus className='h-4 w-4' />
                                    </Button>
                                    <Button variant='ghost' size='sm' onClick={() => setEditing(node)}>
                                        <Pencil className='h-4 w-4' />
                                    </Button>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        disabled={removeMutation.isPending}
                                        onClick={() => {
                                            if (node.child_count > 0 || node.question_count > 0) {
                                                toast.error(
                                                    t('topic_not_empty', {
                                                        children: node.child_count,
                                                        questions: node.question_count,
                                                    }),
                                                );
                                                return;
                                            }
                                            removeMutation.mutate(node.id);
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

            <TopicDialog
                open={creatingUnder !== undefined || editing !== null}
                topic={editing}
                parentId={creatingUnder ?? null}
                allTopics={topics ?? []}
                onClose={() => {
                    setCreatingUnder(undefined);
                    setEditing(null);
                }}
                onSaved={() => void invalidate()}
            />
        </PageShell>
    );
}

interface TopicDialogProps {
    open: boolean;
    /** null — создание; иначе правка. */
    topic: QuizTopicNode | null;
    parentId: number | null;
    allTopics: QuizTopicNode[];
    onClose: () => void;
    onSaved: () => void;
}

function TopicDialog({ open, topic, parentId, allTopics, onClose, onSaved }: TopicDialogProps) {
    const t = useTranslations('admin.quizzes');
    const [name, setName] = useState('');
    const [parent, setParent] = useState<string>(ROOT_VALUE);
    const [seeded, setSeeded] = useState<number | null | 'new' | undefined>(undefined);

    // Сеем поля один раз на открытие: править их в useEffect на каждый рендер
    // значило бы затирать то, что оператор уже набрал.
    const seedKey = topic ? topic.id : 'new';
    if (open && seeded !== seedKey) {
        setSeeded(seedKey);
        setName(topic?.name ?? '');
        setParent(topic ? (topic.parent_id == null ? ROOT_VALUE : String(topic.parent_id)) : parentId == null ? ROOT_VALUE : String(parentId));
    }
    if (!open && seeded !== undefined) setSeeded(undefined);

    /**
     * В родители нельзя предлагать саму тему и её потомков — сервер такой
     * перенос отвергнет как цикл, и показывать заведомо ошибочный вариант
     * значит подставлять оператора.
     */
    const parentOptions = useMemo(() => {
        if (!topic) return allTopics;
        const banned = new Set<number>([topic.id]);
        let grew = true;
        while (grew) {
            grew = false;
            for (const cand of allTopics) {
                if (cand.parent_id != null && banned.has(cand.parent_id) && !banned.has(cand.id)) {
                    banned.add(cand.id);
                    grew = true;
                }
            }
        }
        return allTopics.filter((x) => !banned.has(x.id));
    }, [allTopics, topic]);

    const saveMutation = useMutation({
        mutationFn: () => {
            const parsedParent = parent === ROOT_VALUE ? null : Number(parent);
            return topic
                ? updateQuizTopic(topic.id, { name: name.trim(), parent_id: parsedParent })
                : createQuizTopic({ name: name.trim(), parent_id: parsedParent });
        },
        onSuccess: () => {
            toast.success(topic ? t('topic_updated') : t('topic_created'));
            onSaved();
            onClose();
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : t('generic_error')),
    });

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{topic ? t('topic_edit_title') : t('topic_create_title')}</DialogTitle>
                    <DialogDescription>{t('topics_page_subtitle')}</DialogDescription>
                </DialogHeader>

                <div className='space-y-4'>
                    <div className='space-y-1'>
                        <Label htmlFor='topic-name'>{t('topic_name_label')}</Label>
                        <Input
                            id='topic-name'
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={255}
                        />
                    </div>
                    <div className='space-y-1'>
                        <Label>{t('topic_parent_label')}</Label>
                        <Select value={parent} onValueChange={setParent}>
                            <SelectTrigger className='w-full'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ROOT_VALUE}>{t('topic_parent_root')}</SelectItem>
                                {parentOptions.map((x) => (
                                    <SelectItem key={x.id} value={String(x.id)}>
                                        {x.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant='outline' onClick={onClose}>
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={name.trim().length === 0 || saveMutation.isPending}
                    >
                        {t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
