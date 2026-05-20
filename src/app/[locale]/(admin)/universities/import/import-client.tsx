'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import {
    downloadTemplate,
    importExcel,
    triggerBrowserDownload,
} from '@/lib/universities/api';
import type { ImportKind, ImportResult, ImportResultRow } from '@/lib/universities/types';

const FILENAMES: Record<ImportKind, string> = {
    universities: 'Universities-template.xlsx',
    specialties: 'Specialties-template.xlsx',
    admission_stats: 'AdmissionStats-template.xlsx',
};

function statusVariant(status: ImportResultRow['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'insert':
            return 'default';
        case 'update':
            return 'outline';
        case 'skip':
            return 'secondary';
        case 'error':
            return 'destructive';
    }
}

export function ImportClient() {
    const t = useTranslations('universities.import');
    const locale = useLocale();
    const qc = useQueryClient();

    const [kind, setKind] = useState<ImportKind>('universities');
    const [file, setFile] = useState<File | null>(null);
    const [dryRun, setDryRun] = useState<ImportResult | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const handleTemplate = async () => {
        try {
            const blob = await downloadTemplate(kind);
            triggerBrowserDownload(blob, FILENAMES[kind]);
        } catch (e) {
            toast.error((e as Error).message);
        }
    };

    const dryMutation = useMutation({
        mutationFn: async () => {
            if (!file) throw new Error('no_file');
            return importExcel({ kind, mode: 'dry_run', file });
        },
        onSuccess: (res) => setDryRun(res),
        onError: (e: Error) => toast.error(e.message),
    });

    const commitMutation = useMutation({
        mutationFn: async () => {
            if (!file || !dryRun) throw new Error('no_file');
            return importExcel({
                kind,
                mode: 'commit',
                file,
                bulkOpId: dryRun.bulk_op_id,
                confirmedCount: dryRun.affected,
            });
        },
        onSuccess: async (res) => {
            await qc.invalidateQueries({ queryKey: ['admin.universities.list'] });
            await qc.invalidateQueries({ queryKey: ['admin.specialties.list'] });
            await qc.invalidateQueries({ queryKey: ['admin.admission_stats.list'] });
            toast.success(
                t('committed_toast', {
                    inserted: res.insert,
                    updated: res.update,
                    failed: res.error,
                }),
            );
            setDryRun(res);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const reset = () => {
        setFile(null);
        setDryRun(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null;
        if (f && f.size > 5 * 1024 * 1024) {
            toast.error(t('error_too_large'));
            return;
        }
        setFile(f);
        setDryRun(null);
    };

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('title')}
                    subtitle={t('subtitle')}
                    actions={
                        <Button variant='outline' size='sm' asChild>
                            <Link href={`/${locale}/universities`}>
                                <ChevronLeft className='mr-1 size-4' />
                                {t('back')}
                            </Link>
                        </Button>
                    }
                />
            }
            contentClassName='space-y-4'
        >
            <Card className='p-4'>
                <Tabs
                    value={kind}
                    onValueChange={(v) => {
                        setKind(v as ImportKind);
                        reset();
                    }}
                >
                    <TabsList>
                        <TabsTrigger value='universities'>{t('kind_universities')}</TabsTrigger>
                        <TabsTrigger value='specialties'>{t('kind_specialties')}</TabsTrigger>
                        <TabsTrigger value='admission_stats'>{t('kind_admission')}</TabsTrigger>
                    </TabsList>
                </Tabs>
                <p className='mt-3 text-sm text-muted-foreground'>{t(`hint_${kind}`)}</p>
            </Card>

            <Card className='p-6'>
                <div className='flex flex-wrap items-center gap-3'>
                    <Button variant='outline' onClick={() => void handleTemplate()}>
                        <Download className='mr-2 size-4' />
                        {t('download_template')}
                    </Button>
                    <input
                        ref={inputRef}
                        type='file'
                        accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        onChange={onFileChange}
                        className='hidden'
                        id='import-file'
                    />
                    <Button asChild variant='secondary'>
                        <label htmlFor='import-file' className='cursor-pointer'>
                            <FileSpreadsheet className='mr-2 size-4' />
                            {file ? file.name : t('select_file')}
                        </label>
                    </Button>
                    <Button
                        onClick={() => dryMutation.mutate()}
                        disabled={!file || dryMutation.isPending}
                    >
                        <Upload className='mr-2 size-4' />
                        {dryMutation.isPending ? t('analyzing') : t('analyze')}
                    </Button>
                    {file ? (
                        <Button variant='ghost' size='sm' onClick={reset}>
                            {t('reset')}
                        </Button>
                    ) : null}
                </div>
            </Card>

            {dryRun ? (
                <Card className='p-6'>
                    <div className='mb-4 flex flex-wrap items-center gap-3'>
                        <Badge variant='default'>
                            {t('summary_insert')}: {dryRun.insert}
                        </Badge>
                        <Badge variant='outline'>
                            {t('summary_update')}: {dryRun.update}
                        </Badge>
                        <Badge variant='secondary'>
                            {t('summary_skip')}: {dryRun.skip}
                        </Badge>
                        <Badge variant='destructive'>
                            {t('summary_error')}: {dryRun.error}
                        </Badge>
                        <div className='ml-auto'>
                            {dryRun.mode === 'dry_run' && dryRun.affected > 0 ? (
                                <Button onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending}>
                                    {commitMutation.isPending
                                        ? t('committing')
                                        : t('commit', { count: dryRun.affected })}
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    {dryRun.rows.length > 0 ? (
                        <div className='max-h-[480px] overflow-auto'>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className='w-[80px]'>{t('col_row')}</TableHead>
                                        <TableHead className='w-[100px]'>{t('col_status')}</TableHead>
                                        <TableHead>{t('col_reason')}</TableHead>
                                        <TableHead className='w-[100px]'>{t('col_entity')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dryRun.rows.map((r) => (
                                        <TableRow key={`${r.row_index}-${r.row_id}`}>
                                            <TableCell className='font-mono text-xs'>{r.row_index}</TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariant(r.status)}>{t(`status_${r.status}`)}</Badge>
                                            </TableCell>
                                            <TableCell className='text-xs text-muted-foreground'>
                                                {r.reason ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                {r.entity_id !== null ? (
                                                    <span className='font-mono text-xs'>#{r.entity_id}</span>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : null}
                </Card>
            ) : null}
        </PageShell>
    );
}
