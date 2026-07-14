'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CoursePicker } from '@/components/courses/course-picker';
import { downloadCreditQuestionsTemplate, importCreditQuestionsExcel, listCreditTopics, triggerXlsxDownload } from '@/lib/credits/api';
import { getCourse } from '@/lib/courses/api';
import { chapterDisplayTitle, chapterItemDisplayTitle } from '@/lib/credits/format';
import { buildCreditTopicTree, flattenCreditTopicTree } from '@/lib/credits/topic-tree';
import type { CreditQuestionImportResult, CreditQuestionImportRow } from '@/lib/credits/types';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface QuestionsImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// #5 — the whole batch is tagged to ONE target chosen here: a course lesson
// (chapter_item_id) or a custom bank topic (topic_id). Tests (quiz) and
// assignments are hidden from the course-lesson picker.
type ImportMode = 'course' | 'custom';

/** Bulk import of bank questions from an Excel workbook into ONE topic/lesson (item 1). */
export function QuestionsImportDialog({ open, onOpenChange }: QuestionsImportDialogProps) {
    const t = useTranslations('admin.credit_questions.import');
    const qc = useQueryClient();

    const [mode, setMode] = useState<ImportMode>('course');
    const [courseId, setCourseId] = useState<number | null>(null);
    const [chapterId, setChapterId] = useState<number | null>(null);
    const [lessonId, setLessonId] = useState<number | null>(null);
    const [customTopicId, setCustomTopicId] = useState<string | null>(null);

    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<CreditQuestionImportResult | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Fresh target selection each time the dialog opens.
    useEffect(() => {
        if (!open) return;
        setMode('course');
        setCourseId(null);
        setChapterId(null);
        setLessonId(null);
        setCustomTopicId(null);
        setFile(null);
        setResult(null);
        if (inputRef.current) inputRef.current.value = '';
    }, [open]);

    // Custom topics («Жеке тақырыптар») — lesson-backed topics are excluded; those
    // are tagged through the Курс branch instead.
    const { data: topics = [] } = useQuery({
        queryKey: ['admin.credits.topics', { include_archived: false }],
        queryFn: () => listCreditTopics(false),
        staleTime: 30_000,
        enabled: open,
    });
    const customFlat = useMemo(
        () => flattenCreditTopicTree(buildCreditTopicTree(topics.filter((tp) => tp.chapter_item_id == null))),
        [topics]
    );

    const courseDetail = useQuery({
        queryKey: ['admin.courses.detail', courseId],
        queryFn: () => getCourse(courseId as number),
        enabled: open && courseId != null,
        staleTime: 60_000,
    });
    const chapters = useMemo(() => courseDetail.data?.chapters ?? [], [courseDetail.data]);
    const selectedChapter = useMemo(() => chapters.find((ch) => ch.id === chapterId) ?? null, [chapters, chapterId]);
    // #5 — only content lessons; tests (quiz) and assignments are hidden.
    const lessonItems = useMemo(
        () => (selectedChapter ? selectedChapter.items.filter((it) => it.type === 'file') : []),
        [selectedChapter]
    );

    const target = useMemo<{ topic_id?: string; chapter_item_id?: number } | null>(() => {
        if (mode === 'course') return lessonId != null ? { chapter_item_id: lessonId } : null;
        return customTopicId ? { topic_id: customTopicId } : null;
    }, [mode, lessonId, customTopicId]);

    const targetLabel = useMemo(() => {
        if (mode === 'course') {
            const item = lessonItems.find((it) => it.id === lessonId);
            return item ? chapterItemDisplayTitle(item) : null;
        }
        return customFlat.find((f) => f.node.id === customTopicId)?.node.name ?? null;
    }, [mode, lessonId, lessonItems, customTopicId, customFlat]);

    const reasonLabel = (reason: string | null): string => {
        if (!reason) return '—';
        return t.has(`reasons.${reason}`) ? t(`reasons.${reason}`) : reason;
    };

    const resetFile = () => {
        setFile(null);
        setResult(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleOpenChange = (next: boolean) => {
        onOpenChange(next);
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null;
        if (f && f.size > MAX_FILE_BYTES) {
            toast.error(t('error_too_large'));
            return;
        }
        setFile(f);
        setResult(null);
    };

    const downloadTemplate = async () => {
        try {
            const blob = await downloadCreditQuestionsTemplate();
            triggerXlsxDownload(blob, 'credit-questions-template.xlsx');
        } catch (e) {
            toast.error((e as Error).message);
        }
    };

    const importMutation = useMutation({
        mutationFn: async () => {
            if (!file) throw new Error(t('no_file'));
            if (!target) throw new Error(t('no_target'));
            return importCreditQuestionsExcel(target, file);
        },
        onSuccess: (res) => {
            setResult(res);
            void qc.invalidateQueries({ queryKey: ['admin.credit-questions.list'], exact: false });
            void qc.invalidateQueries({ queryKey: ['admin.credits.topics'], exact: false });
            if (res.succeeded > 0) {
                toast.success(t('done_toast', { succeeded: res.succeeded, failed: res.failed }));
            } else {
                toast.error(t('none_imported_toast', { failed: res.failed }));
            }
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const failedRows: CreditQuestionImportRow[] = result ? result.rows.filter((r) => r.status === 'error') : [];

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className='max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{t('dialog_title')}</DialogTitle>
                    <DialogDescription>{t('dialog_description')}</DialogDescription>
                </DialogHeader>

                <div className='space-y-4'>
                    {/* Target picker — a course lesson or a custom topic. */}
                    <div className='space-y-3 rounded-md border p-3'>
                        <ToggleGroup
                            type='single'
                            variant='outline'
                            value={mode}
                            onValueChange={(v) => {
                                if (v) setMode(v as ImportMode);
                            }}
                        >
                            <ToggleGroupItem value='course'>{t('mode_course')}</ToggleGroupItem>
                            <ToggleGroupItem value='custom'>{t('mode_custom')}</ToggleGroupItem>
                        </ToggleGroup>

                        {mode === 'course' ? (
                            <div className='grid gap-3 sm:grid-cols-3'>
                                <div className='min-w-0'>
                                    <CoursePicker
                                        value={courseId}
                                        onChange={(id) => {
                                            setCourseId(id);
                                            setChapterId(null);
                                            setLessonId(null);
                                        }}
                                        placeholder={t('course_placeholder')}
                                    />
                                </div>
                                <Select
                                    value={chapterId != null ? String(chapterId) : ''}
                                    onValueChange={(v) => {
                                        setChapterId(Number(v));
                                        setLessonId(null);
                                    }}
                                    disabled={courseId == null}
                                >
                                    <SelectTrigger className='w-full'>
                                        <SelectValue placeholder={courseId == null ? t('select_course_first') : t('module_placeholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {chapters.length === 0 ? (
                                            <div className='text-muted-foreground p-2 text-xs'>
                                                {courseDetail.isFetching ? t('loading') : t('no_modules')}
                                            </div>
                                        ) : (
                                            chapters.map((ch) => (
                                                <SelectItem key={ch.id} value={String(ch.id)}>
                                                    {chapterDisplayTitle(ch)}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={lessonId != null ? String(lessonId) : ''}
                                    onValueChange={(v) => setLessonId(Number(v))}
                                    disabled={selectedChapter == null}
                                >
                                    <SelectTrigger className='w-full'>
                                        <SelectValue
                                            placeholder={selectedChapter == null ? t('select_module_first') : t('lesson_placeholder')}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {lessonItems.length === 0 ? (
                                            <div className='text-muted-foreground p-2 text-xs'>{t('no_lessons')}</div>
                                        ) : (
                                            lessonItems.map((item) => (
                                                <SelectItem key={item.id} value={String(item.id)}>
                                                    {chapterItemDisplayTitle(item)}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <Select value={customTopicId ?? ''} onValueChange={(v) => setCustomTopicId(v)}>
                                <SelectTrigger className='w-full'>
                                    <SelectValue placeholder={t('topic_placeholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {customFlat.length === 0 ? (
                                        <div className='text-muted-foreground p-2 text-xs'>{t('no_topics')}</div>
                                    ) : (
                                        customFlat.map(({ node, depth }) => (
                                            <SelectItem key={node.id} value={node.id}>
                                                {' '.repeat(depth * 3)}
                                                {node.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {target ? (
                        <Alert>
                            <AlertDescription>{t('target_notice', { topic: targetLabel || '—' })}</AlertDescription>
                        </Alert>
                    ) : (
                        <Alert variant='destructive'>
                            <AlertDescription>{t('select_target_first')}</AlertDescription>
                        </Alert>
                    )}

                    <Button variant='outline' size='sm' onClick={() => void downloadTemplate()}>
                        <Download className='mr-2 size-4' />
                        {t('download_template')}
                    </Button>

                    <div className='flex flex-wrap items-center gap-3'>
                        <input
                            ref={inputRef}
                            type='file'
                            accept={XLSX_ACCEPT}
                            onChange={onFileChange}
                            className='hidden'
                            id='credit-questions-import-file'
                            disabled={!target}
                        />
                        <Button asChild variant='secondary' disabled={!target}>
                            <label htmlFor='credit-questions-import-file' className='cursor-pointer'>
                                <FileSpreadsheet className='mr-2 size-4' />
                                {file ? file.name : t('select_file')}
                            </label>
                        </Button>
                        <Button onClick={() => importMutation.mutate()} disabled={!file || !target || importMutation.isPending}>
                            <Upload className='mr-2 size-4' />
                            {importMutation.isPending ? t('uploading') : t('upload')}
                        </Button>
                        {file ? (
                            <Button variant='ghost' size='sm' onClick={resetFile}>
                                {t('reset')}
                            </Button>
                        ) : null}
                    </div>

                    {result ? (
                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Badge variant='secondary'>
                                    {t('summary_total')}: {result.total}
                                </Badge>
                                <Badge variant='success'>
                                    {t('summary_succeeded')}: {result.succeeded}
                                </Badge>
                                <Badge variant='destructive'>
                                    {t('summary_failed')}: {result.failed}
                                </Badge>
                            </div>

                            {failedRows.length > 0 ? (
                                <div className='max-h-[360px] overflow-auto rounded-md border'>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className='w-[80px]'>{t('col_row')}</TableHead>
                                                <TableHead>{t('col_reason')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {failedRows.map((r) => (
                                                <TableRow key={r.row}>
                                                    <TableCell className='font-mono text-xs'>{r.row}</TableCell>
                                                    <TableCell className='text-muted-foreground text-xs'>{reasonLabel(r.reason)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <p className='text-muted-foreground text-sm'>{t('all_ok')}</p>
                            )}
                        </div>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button variant='outline' onClick={() => handleOpenChange(false)}>
                        {t('close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
