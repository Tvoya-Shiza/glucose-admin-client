'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Images, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useMultiFileUpload, type MultiUploadItem } from '@/lib/uploads/use-multi-file-upload';

export interface BulkUploadedPage {
    file_name: string;
    image_url: string;
}

interface BulkPagesUploadProps {
    /** Вызывается один раз, когда вся пачка догрузилась: страницы в порядке имён файлов. */
    onUploaded: (pages: BulkUploadedPage[]) => void;
    disabled?: boolean;
}

/**
 * Загрузка книги целиком: оператор выбирает сразу все сканы страниц, они
 * уходят очередью и превращаются в строки страниц одним действием.
 *
 * Зачем: раньше каждая страница добавлялась вручную — «Бет қосу», выбрать файл,
 * повторить. Для книги на двести страниц это неработоспособно.
 *
 * Порядок страниц берём из имён файлов и сравниваем «по-человечески»
 * (`numeric: true`), иначе page10 встаёт между page1 и page2. Сама нумерация
 * проставляется вызывающим кодом — он знает, какие номера в книге уже заняты.
 *
 * Загрузка идёт через общий `useMultiFileUpload`: очередь с ограничением в три
 * одновременных запроса, по одному upload-токену на файл (сервер намеренно не
 * принимает несколько файлов за раз). Сохранение страниц при этом остаётся
 * пакетным — один PUT на всю книгу.
 */
export function BulkPagesUpload({ onUploaded, disabled }: BulkPagesUploadProps) {
    const t = useTranslations('admin.ebooks');
    const inputRef = useRef<HTMLInputElement>(null);

    const upload = useMultiFileUpload({
        resolveKind: () => 'image',
        onSettled: (items) => {
            const done = items.filter((it) => it.state === 'done' && it.result);
            const failed = items.length - done.length;

            if (done.length > 0) {
                onUploaded(
                    done.map((it) => ({
                        file_name: it.file.name,
                        image_url: (it.result as NonNullable<MultiUploadItem['result']>).file_url,
                    })),
                );
            }
            if (failed > 0) toast.error(t('bulk_upload_failed', { count: failed }));
            upload.clear();
        },
    });

    const pick = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        // Сортируем до постановки в очередь: очередь сохраняет порядок enqueue,
        // а он и определяет номера страниц.
        const sorted = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        upload.enqueue(sorted);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <Card className='space-y-3 p-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='space-y-0.5'>
                    <p className='text-sm font-medium'>{t('bulk_upload_title')}</p>
                    <p className='text-muted-foreground text-xs'>{t('bulk_upload_hint')}</p>
                </div>
                <div className='flex items-center gap-2'>
                    {upload.active ? (
                        <Button variant='ghost' size='sm' onClick={upload.cancelAll}>
                            <X className='mr-2 h-4 w-4' />
                            {t('bulk_upload_cancel')}
                        </Button>
                    ) : null}
                    <Button variant='outline' onClick={() => inputRef.current?.click()} disabled={disabled || upload.active}>
                        {upload.active ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Images className='mr-2 h-4 w-4' />}
                        {upload.active ? t('bulk_upload_running') : t('bulk_upload_pick')}
                    </Button>
                </div>
            </div>

            {upload.active ? (
                <div className='space-y-1'>
                    <div className='bg-muted h-2 w-full overflow-hidden rounded-full'>
                        <div
                            className='bg-primary h-full rounded-full transition-[width] duration-300'
                            style={{ width: `${upload.overallProgress}%` }}
                        />
                    </div>
                    <p className='text-muted-foreground text-xs'>
                        {t('bulk_upload_progress', {
                            done: upload.items.filter((it) => it.state === 'done').length,
                            total: upload.items.length,
                        })}
                    </p>
                </div>
            ) : null}

            <input
                ref={inputRef}
                type='file'
                accept='image/jpeg,image/png,image/webp'
                multiple
                hidden
                onChange={(e) => pick(e.target.files)}
            />
        </Card>
    );
}
