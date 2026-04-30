'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TypeTheCountConfirmation } from '@/components/users/type-the-count-confirmation';
import { buildErrorReportCsv, parseCsvFile, type ErrorReportRow } from '@/lib/users/csv';
import { importUsers, type ImportInput, type ImportResultPayload, type ImportRowInput } from '@/lib/users/api';

/**
 * USR-06 — admin-only CSV import page.
 *
 * Flow:
 *   1. File picker → parseCsvFile (5MB / 10k row caps enforced).
 *   2. Click "Preview" → POST /api/proxy/v1/admin/users/import with mode='dry_run'.
 *      Server returns per-row report; we render badges + table.
 *   3. Click "Commit" → if affected > 50, gate via TypeTheCountConfirmation;
 *      otherwise commit immediately. Both paths POST mode='commit' with the
 *      same `bulk_op_id` returned by dry-run, so the audit trail links them.
 *   4. "Download error report" builds a CSV mirroring the upload + status/reason.
 *
 * Predicate symmetry: the server's commit re-runs the dry-run classification, so
 * what the user sees in the preview is what hits the DB (race window documented in
 * the service: a concurrent import could collide on @unique email/mobile mid-flight,
 * surfacing as `error: conflict_runtime` per row).
 *
 * After commit success, we invalidate the users list query so the new rows appear.
 */
export function ImportClient() {
    const t = useTranslations('admin.users');
    const qc = useQueryClient();
    const [parsedRows, setParsedRows] = useState<ImportRowInput[]>([]);
    const [dryRunResult, setDryRunResult] = useState<ImportResultPayload | null>(null);
    const [showCountGate, setShowCountGate] = useState(false);
    const [bulkOpId, setBulkOpId] = useState<string | null>(null);

    const onFile = async (file: File) => {
        try {
            const { rows, errors } = await parseCsvFile(file);
            if (errors.length > 0) toast.warning(`csv_parse_warnings:${errors.length}`);
            const norm: ImportRowInput[] = rows.map((r, i) => {
                const role = (r.role_name?.trim().toLowerCase() ?? '') as ImportRowInput['role_name'];
                const status = (r.status?.trim().toLowerCase() ?? '') as ImportRowInput['status'];
                return {
                    row_id: r.row_id?.trim() || String(i + 1),
                    full_name: r.full_name?.trim() || undefined,
                    email: r.email?.trim() || undefined,
                    mobile: r.mobile?.trim() || undefined,
                    role_name: role || undefined,
                    status: status || undefined,
                };
            });
            setParsedRows(norm);
            setDryRunResult(null);
            setBulkOpId(null);
            toast.success(`parsed_${norm.length}_rows`);
        } catch (e) {
            const msg = e instanceof Error ? e.message : t('error_generic');
            toast.error(msg);
        }
    };

    const dryRun = useMutation({
        mutationFn: () => importUsers({ mode: 'dry_run', rows: parsedRows } satisfies ImportInput),
        onSuccess: (r) => {
            setDryRunResult(r);
            setBulkOpId(r.bulk_op_id);
        },
        onError: (e: Error) => toast.error(e.message ?? t('error_generic')),
    });

    const commit = useMutation({
        mutationFn: (confirmed_count?: number) =>
            importUsers({
                mode: 'commit',
                rows: parsedRows,
                bulk_op_id: bulkOpId ?? undefined,
                confirmed_count,
            } satisfies ImportInput),
        onSuccess: (r) => {
            setDryRunResult(r);
            setShowCountGate(false);
            toast.success(t('saved'));
            void qc.invalidateQueries({ queryKey: ['admin.users.list'], exact: false });
        },
        onError: (e: Error) => toast.error(e.message ?? t('save_failed')),
    });

    const onCommit = () => {
        const affected = dryRunResult?.affected ?? 0;
        if (affected > 50) {
            setShowCountGate(true);
        } else {
            commit.mutate(affected);
        }
    };

    const downloadErrorReport = () => {
        if (!dryRunResult) return;
        const lookup = new Map(parsedRows.map((r) => [r.row_id, r]));
        const errRows: ErrorReportRow[] = dryRunResult.rows.map((r) => {
            const src = lookup.get(r.row_id);
            return {
                row_id: r.row_id,
                full_name: src?.full_name,
                email: src?.email,
                mobile: src?.mobile,
                role_name: src?.role_name,
                status: r.status,
                reason: r.reason,
            };
        });
        const blob = buildErrorReportCsv(errRows);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-import-report-${bulkOpId ?? 'preview'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className='space-y-4 p-6'>
            <header>
                <h1 className='text-2xl font-semibold'>{t('import_title')}</h1>
                <p className='text-sm text-muted-foreground'>{t('import_drop')}</p>
            </header>

            <div className='space-y-3'>
                <Input
                    type='file'
                    accept='.csv,text/csv'
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onFile(f);
                    }}
                />
                {parsedRows.length > 0 ? (
                    <p className='text-sm text-muted-foreground'>parsed: {parsedRows.length}</p>
                ) : null}
                <div className='flex flex-wrap gap-2'>
                    <Button
                        disabled={parsedRows.length === 0 || dryRun.isPending}
                        onClick={() => dryRun.mutate()}
                    >
                        {dryRun.isPending ? t('loading') : t('import_dry_run')}
                    </Button>
                    {dryRunResult ? (
                        <>
                            <Button onClick={onCommit} disabled={commit.isPending || dryRunResult.affected === 0}>
                                {commit.isPending ? t('saving') : t('import_commit')}
                            </Button>
                            <Button variant='outline' onClick={downloadErrorReport}>
                                {t('import_error_report')}
                            </Button>
                        </>
                    ) : null}
                </div>
            </div>

            {dryRunResult ? (
                <div className='space-y-3 rounded-md border p-4'>
                    <div className='flex flex-wrap gap-2 text-xs'>
                        <Badge variant='default'>insert: {dryRunResult.insert}</Badge>
                        <Badge variant='secondary'>update: {dryRunResult.update}</Badge>
                        <Badge variant='outline'>skip: {dryRunResult.skip}</Badge>
                        <Badge variant='destructive'>error: {dryRunResult.error}</Badge>
                    </div>
                    <div className='max-h-72 overflow-auto rounded-md border'>
                        <table className='w-full text-sm'>
                            <thead className='border-b bg-muted/40'>
                                <tr>
                                    <th className='p-2 text-left'>row_id</th>
                                    <th className='p-2 text-left'>status</th>
                                    <th className='p-2 text-left'>reason</th>
                                    <th className='p-2 text-left'>user_id</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dryRunResult.rows.slice(0, 200).map((r) => (
                                    <tr key={r.row_id} className='border-b last:border-0'>
                                        <td className='p-2 font-mono text-xs'>{r.row_id}</td>
                                        <td className='p-2'>{r.status}</td>
                                        <td className='p-2 text-muted-foreground'>{r.reason ?? ''}</td>
                                        <td className='p-2 font-mono text-xs'>{r.user_id ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            {showCountGate && dryRunResult ? (
                <div className='rounded-md border p-4'>
                    <TypeTheCountConfirmation
                        count={dryRunResult.affected}
                        onConfirm={() => commit.mutate(dryRunResult.affected)}
                        onCancel={() => setShowCountGate(false)}
                    />
                </div>
            ) : null}
        </div>
    );
}
