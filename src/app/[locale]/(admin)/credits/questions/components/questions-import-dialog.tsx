'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadCreditQuestionsTemplate, importCreditQuestionsExcel, triggerXlsxDownload } from '@/lib/credits/api';
import type { CreditQuestionImportResult, CreditQuestionImportRow } from '@/lib/credits/types';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface QuestionsImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Target topic (credit_topics.id) — all imported rows land here. Null → import disabled. */
    topicId: string | null;
    /** Human-readable topic label for the target notice. */
    topicName?: string | null;
}

/** Bulk import of bank questions from an Excel workbook into ONE topic (item 1). */
export function QuestionsImportDialog({ open, onOpenChange, topicId, topicName }: QuestionsImportDialogProps) {
    const t = useTranslations('admin.credit_questions.import');
    const qc = useQueryClient();

    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<CreditQuestionImportResult | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

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
            if (!topicId) throw new Error(t('no_topic'));
            return importCreditQuestionsExcel({ topic_id: topicId }, file);
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
                    {topicId ? (
                        <Alert>
                            <AlertDescription>{t('target_notice', { topic: topicName || `#${topicId}` })}</AlertDescription>
                        </Alert>
                    ) : (
                        <Alert variant='destructive'>
                            <AlertDescription>{t('select_topic_first')}</AlertDescription>
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
                            disabled={!topicId}
                        />
                        <Button asChild variant='secondary' disabled={!topicId}>
                            <label htmlFor='credit-questions-import-file' className='cursor-pointer'>
                                <FileSpreadsheet className='mr-2 size-4' />
                                {file ? file.name : t('select_file')}
                            </label>
                        </Button>
                        <Button onClick={() => importMutation.mutate()} disabled={!file || !topicId || importMutation.isPending}>
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
