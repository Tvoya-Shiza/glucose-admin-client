'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { importQuestionsExcel, triggerXlsxDownload } from '@/lib/quizzes/api';
import type { QuestionImportResult, QuestionImportRow, QuizQuestionType } from '@/lib/quizzes/types';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface QuestionsImportDialogProps {
    quizId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function QuestionsImportDialog({ quizId, open, onOpenChange }: QuestionsImportDialogProps) {
    const t = useTranslations('admin.quizzes.import');
    const qc = useQueryClient();

    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<QuestionImportResult | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const typeLabel = (type: QuizQuestionType): string =>
        t.has(`type_${type}`) ? t(`type_${type}`) : type;
    const reasonLabel = (reason: string | null): string => {
        if (!reason) return '—';
        return t.has(`reasons.${reason}`) ? t(`reasons.${reason}`) : reason;
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) reset();
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

    const importMutation = useMutation({
        mutationFn: async () => {
            if (!file) throw new Error(t('no_file'));
            return importQuestionsExcel(quizId, file);
        },
        onSuccess: (res) => {
            setResult(res);
            void qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            void qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            void qc.invalidateQueries({ queryKey: ['admin.quizzes.list'] });
            if (res.succeeded > 0) {
                toast.success(t('done_toast', { succeeded: res.succeeded, failed: res.failed }));
            } else {
                toast.error(t('none_imported_toast', { failed: res.failed }));
            }
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const failedRows: QuestionImportRow[] = result ? result.rows.filter((r) => r.status === 'error') : [];
    const unmatchedTopics = result ? result.rows.filter((r) => r.topic_unmatched).length : 0;

    const downloadErrors = async () => {
        try {
            const ExcelJS = await import('exceljs');
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet(t('errors_sheet_name'));
            ws.columns = [
                { header: t('col_seq'), key: 'seq', width: 8 },
                { header: t('col_sheet'), key: 'sheet', width: 20 },
                { header: t('col_row'), key: 'row', width: 12 },
                { header: t('col_type'), key: 'type', width: 18 },
                { header: t('col_title'), key: 'title', width: 50 },
                { header: t('col_reason'), key: 'reason', width: 44 },
            ];
            ws.getRow(1).font = { bold: true };
            for (const r of failedRows) {
                ws.addRow({
                    seq: r.seq ?? '—',
                    sheet: r.sheet,
                    row: r.row,
                    type: typeLabel(r.type),
                    title: r.title,
                    reason: reasonLabel(r.reason),
                });
            }
            const ab = await wb.xlsx.writeBuffer();
            triggerXlsxDownload(new Blob([ab]), t('errors_filename'));
        } catch (e) {
            toast.error((e as Error).message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className='max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{t('dialog_title')}</DialogTitle>
                    <DialogDescription>{t('dialog_description')}</DialogDescription>
                </DialogHeader>

                <div className='space-y-4'>
                    <div className='flex flex-wrap items-center gap-3'>
                        <input
                            ref={inputRef}
                            type='file'
                            accept={XLSX_ACCEPT}
                            onChange={onFileChange}
                            className='hidden'
                            id='questions-import-file'
                        />
                        <Button asChild variant='secondary'>
                            <label htmlFor='questions-import-file' className='cursor-pointer'>
                                <FileSpreadsheet className='mr-2 size-4' />
                                {file ? file.name : t('select_file')}
                            </label>
                        </Button>
                        <Button onClick={() => importMutation.mutate()} disabled={!file || importMutation.isPending}>
                            <Upload className='mr-2 size-4' />
                            {importMutation.isPending ? t('uploading') : t('upload')}
                        </Button>
                        {file ? (
                            <Button variant='ghost' size='sm' onClick={reset}>
                                {t('reset')}
                            </Button>
                        ) : null}
                    </div>

                    {result ? (
                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Badge variant='secondary'>{t('summary_total')}: {result.total}</Badge>
                                <Badge variant='success'>{t('summary_succeeded')}: {result.succeeded}</Badge>
                                <Badge variant='destructive'>{t('summary_failed')}: {result.failed}</Badge>
                                <Badge variant='outline'>{t('summary_answers')}: {result.imported_answers}</Badge>
                                {failedRows.length > 0 ? (
                                    <Button variant='outline' size='sm' className='ml-auto' onClick={() => void downloadErrors()}>
                                        <Download className='mr-2 size-4' />
                                        {t('download_errors')}
                                    </Button>
                                ) : null}
                            </div>

                            {/* Ненайденные темы и разорванные блоки — не ошибки строк:
                                вопросы загружены, но требуют внимания методиста. */}
                            {unmatchedTopics > 0 && (
                                <p className='bg-warning/10 rounded-md p-3 text-sm'>
                                    {t('topic_unmatched_notice', { count: unmatchedTopics })}
                                </p>
                            )}
                            {(result?.passage_contiguity_violations?.length ?? 0) > 0 && (
                                <p className='text-destructive bg-destructive/10 rounded-md p-3 text-sm'>
                                    {t('passage_not_contiguous_notice')}
                                </p>
                            )}

                            {failedRows.length > 0 ? (
                                <div className='max-h-[360px] overflow-auto rounded-md border'>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {/* Two different numbers, and conflating them is what made
                                                    operators read "question 1 failed" as "question 2 failed":
                                                    «№» is theirs, «Жол» is the physical Excel row. */}
                                                <TableHead className='w-[64px]'>{t('col_seq')}</TableHead>
                                                <TableHead className='w-[150px]'>{t('col_sheet')}</TableHead>
                                                <TableHead className='w-[96px]'>{t('col_row')}</TableHead>
                                                <TableHead>{t('col_reason')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {failedRows.map((r) => (
                                                <TableRow key={`${r.sheet}-${r.row}`}>
                                                    <TableCell className='font-mono text-xs'>{r.seq ?? '—'}</TableCell>
                                                    <TableCell className='text-xs'>{r.sheet}</TableCell>
                                                    <TableCell className='text-muted-foreground font-mono text-xs'>{r.row}</TableCell>
                                                    <TableCell className='text-muted-foreground text-xs'>
                                                        {reasonLabel(r.reason)}
                                                    </TableCell>
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
