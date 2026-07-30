'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, FileUp, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PdfImportProps {
    bookId: number;
    /** Номер, с которого продолжить нумерацию: последняя страница книги + 1. */
    nextPageNumber: number;
    /** Вызывается после импорта, чтобы перечитать список страниц. */
    onImported: () => void;
    disabled?: boolean;
}

interface ProgressState {
    total: number;
    done: number;
    current: number;
    failed: number;
    hasText: boolean;
}

/**
 * Импорт книги из PDF: один файл — и страницы появляются сами.
 *
 * Рендер идёт в браузере админки, а не на сервере. На прод-сервере 3.8 ГБ
 * памяти и десяток контейнеров без ограничений; растеризация трёхсот страниц
 * там утащила бы за собой MySQL и оба Next. Браузер оператора эту работу
 * выполняет спокойно, а сервер получает только готовые картинки — ровно тот же
 * поток загрузки, что и при ручном добавлении страницы.
 *
 * Плата за это: вкладку нужно держать открытой до конца импорта. Поэтому
 * страницы сохраняются порциями по ходу дела — при обрыве уже перенесённое
 * остаётся в книге, и импорт можно продолжить с того же места.
 */
export function PdfImport({ bookId, nextPageNumber, onImported, disabled }: PdfImportProps) {
    const t = useTranslations('admin.ebooks');
    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const [progress, setProgress] = useState<ProgressState | null>(null);
    const [noTextWarning, setNoTextWarning] = useState(false);

    const running = progress !== null;

    const start = async (file: File) => {
        if (inputRef.current) inputRef.current.value = '';

        const controller = new AbortController();
        abortRef.current = controller;
        setNoTextWarning(false);
        setProgress({ total: 0, done: 0, current: nextPageNumber, failed: 0, hasText: false });

        try {
            // Тяжёлый модуль pdf.js подтягиваем только здесь: держать его в общем
            // бандле админки ради одной кнопки незачем.
            const { runPdfImport } = await import('@/lib/pdf/run-pdf-import');

            const result = await runPdfImport({
                bookId,
                file,
                startPageNumber: nextPageNumber,
                signal: controller.signal,
                onProgress: (p) =>
                    setProgress({
                        total: p.total,
                        done: p.done,
                        current: p.currentBookPage,
                        failed: p.failed.length,
                        hasText: p.hasText,
                    }),
            });

            if (result.aborted) {
                toast.info(t('pdf_import_stopped', { count: result.imported }));
            } else if (result.failed.length > 0) {
                toast.warning(t('pdf_import_partial', { count: result.imported, failed: result.failed.length }));
            } else {
                toast.success(t('pdf_import_success', { count: result.imported }));
            }

            // Книга без текстового слоя — это скан: поиск по ней работать не будет.
            if (result.imported > 0 && !result.hasText) setNoTextWarning(true);

            onImported();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        } finally {
            abortRef.current = null;
            setProgress(null);
        }
    };

    const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

    return (
        <Card className='space-y-3 p-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='space-y-0.5'>
                    <p className='text-sm font-medium'>{t('pdf_import_title')}</p>
                    <p className='text-muted-foreground text-xs'>{t('pdf_import_hint')}</p>
                </div>
                <div className='flex items-center gap-2'>
                    {running ? (
                        <Button variant='ghost' size='sm' onClick={() => abortRef.current?.abort()}>
                            <X className='mr-2 h-4 w-4' />
                            {t('pdf_import_stop')}
                        </Button>
                    ) : null}
                    <Button variant='default' onClick={() => inputRef.current?.click()} disabled={disabled || running}>
                        {running ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <FileUp className='mr-2 h-4 w-4' />}
                        {running ? t('pdf_import_running') : t('pdf_import_pick')}
                    </Button>
                </div>
            </div>

            {progress ? (
                <div className='space-y-1'>
                    <div className='bg-muted h-2 w-full overflow-hidden rounded-full'>
                        <div
                            className='bg-primary h-full rounded-full transition-[width] duration-300'
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <p className='text-muted-foreground text-xs'>
                        {progress.total > 0
                            ? t('pdf_import_progress', { done: progress.done, total: progress.total })
                            : t('pdf_import_reading')}
                        {progress.failed > 0 ? ` · ${t('pdf_import_failed', { count: progress.failed })}` : ''}
                    </p>
                    <p className='text-muted-foreground text-xs'>{t('pdf_import_keep_open')}</p>
                </div>
            ) : null}

            {noTextWarning ? (
                <Alert variant='default'>
                    <AlertTriangle className='h-4 w-4' />
                    <AlertDescription>{t('pdf_import_no_text')}</AlertDescription>
                </Alert>
            ) : null}

            <input ref={inputRef} type='file' accept='application/pdf' hidden onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void start(file);
            }} />
        </Card>
    );
}
