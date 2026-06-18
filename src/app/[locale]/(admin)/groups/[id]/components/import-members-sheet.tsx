'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Download, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DryRunDialog } from '@/components/users/dry-run-dialog';
import type { DryRunResult } from '@/hooks/use-dry-run-preview';
import { useDryRunPreview } from '@/hooks/use-dry-run-preview';
import { bulkAddMembers, resolveMembers } from '@/lib/groups/api';
import type { ResolveMembersResult, ResolveResultRow, StudentCandidate } from '@/lib/groups/types';
import {
    downloadImportTemplate,
    ImportParseError,
    parseImportXlsx,
    type ParsedImport,
} from '@/lib/groups/excel-import';
import { listUsers } from '@/lib/users/api';
import type { UserRow } from '@/lib/users/types';

export interface ImportMembersSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groupId: number;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** admin-api bulkAdd caps user_ids at 1000 per call — keep one import within a single call. */
const COMMIT_CAP = 1000;

/**
 * GRP-07 — Excel bulk-import of students into a group.
 *
 * Flow (admin-only; rendered behind usePermission('groups.edit') in MembersTab):
 *   1. Upload  — download template, pick .xlsx, parse CLIENT-side (exceljs).
 *   2. Review  — POST rows to /members/resolve; show matched / ambiguous / unmatched.
 *      A single `selected` Map<user_id, candidate> is the source of truth for every
 *      checkbox. Matched & not-already-in-group rows are pre-selected. Unmatched rows
 *      get an inline student search to attach manually.
 *   3. Commit  — reuse the existing dry-run + bulkAddMembers path (>50 confirmation
 *      gate lives in DryRunDialog), exactly like BulkAddMembersSheet.
 */
export function ImportMembersSheet({ open, onOpenChange, groupId }: ImportMembersSheetProps) {
    const t = useTranslations('admin.groups.import');
    const tGroups = useTranslations('admin.groups');
    const qc = useQueryClient();
    const inputRef = useRef<HTMLInputElement | null>(null);

    const [step, setStep] = useState<'upload' | 'review'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [parsed, setParsed] = useState<ParsedImport | null>(null);
    const [resolveResult, setResolveResult] = useState<ResolveMembersResult | null>(null);
    const [selected, setSelected] = useState<Map<number, StudentCandidate>>(new Map());
    const [dryRunOpen, setDryRunOpen] = useState(false);

    const dryRun = useDryRunPreview();

    const reset = () => {
        setStep('upload');
        setFile(null);
        setParsing(false);
        setParsed(null);
        setResolveResult(null);
        setSelected(new Map());
        setDryRunOpen(false);
        dryRun.reset();
        if (inputRef.current) inputRef.current.value = '';
    };

    useEffect(() => {
        if (!open) reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Open the preview dialog once the dry-run resolves; surface errors as a toast.
    useEffect(() => {
        if (dryRun.status === 'success') setDryRunOpen(true);
        if (dryRun.status === 'error' && dryRun.error) toast.error(dryRun.error);
    }, [dryRun.status, dryRun.error]);

    const errLabel = (code: string): string => (t.has(`errors.${code}`) ? t(`errors.${code}`) : code);

    const isSel = (id: number) => selected.has(id);
    const toggleSel = (c: StudentCandidate) =>
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(c.user_id)) next.delete(c.user_id);
            else next.set(c.user_id, c);
            return next;
        });
    const addSel = (c: StudentCandidate) =>
        setSelected((prev) => {
            if (prev.has(c.user_id)) return prev;
            const next = new Map(prev);
            next.set(c.user_id, c);
            return next;
        });

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null;
        if (!f) return;
        if (f.size > MAX_FILE_BYTES) {
            toast.error(errLabel('file_too_large'));
            return;
        }
        setFile(f);
        setParsed(null);
        setParsing(true);
        try {
            const p = await parseImportXlsx(f);
            setParsed(p);
        } catch (err) {
            const code = err instanceof ImportParseError ? err.message : 'parse_failed';
            toast.error(errLabel(code));
            setFile(null);
            if (inputRef.current) inputRef.current.value = '';
        } finally {
            setParsing(false);
        }
    };

    const onDownloadTemplate = async () => {
        try {
            await downloadImportTemplate({
                nameHeader: t('col_name'),
                phoneHeader: t('col_phone'),
                sheetName: t('template_sheet_name'),
                filename: t('template_filename'),
            });
        } catch (err) {
            toast.error((err as Error).message);
        }
    };

    const resolveMutation = useMutation({
        mutationFn: () => {
            if (!parsed) throw new Error(errLabel('no_data_rows'));
            return resolveMembers(groupId, parsed.rows);
        },
        onSuccess: (res) => {
            const init = new Map<number, StudentCandidate>();
            for (const row of res.rows) {
                const c = row.candidates[0];
                if (row.status === 'matched' && c && !c.in_this_group) init.set(c.user_id, c);
            }
            setSelected(init);
            setResolveResult(res);
            setStep('review');
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const counts = useMemo(() => {
        const r = resolveResult?.rows ?? [];
        return {
            matched: r.filter((x) => x.status === 'matched').length,
            ambiguous: r.filter((x) => x.status === 'ambiguous').length,
            unresolved: r.filter((x) => x.status === 'unmatched' || x.status === 'invalid').length,
        };
    }, [resolveResult]);

    const rowsByStatus = useMemo(() => {
        const r = resolveResult?.rows ?? [];
        return {
            matched: r.filter((x) => x.status === 'matched'),
            ambiguous: r.filter((x) => x.status === 'ambiguous'),
            unresolved: r.filter((x) => x.status === 'unmatched' || x.status === 'invalid'),
        };
    }, [resolveResult]);

    // Students chosen to add (excluding any already in this group — they cannot be re-added).
    const selectedList = useMemo(
        () => Array.from(selected.values()).filter((c) => !c.in_this_group),
        [selected],
    );
    const selectedIds = useMemo(() => new Set(selected.keys()), [selected]);

    const onPreview = async () => {
        const ids = selectedList.map((c) => c.user_id);
        if (ids.length === 0) {
            toast.error(t('error_none_selected'));
            return;
        }
        if (ids.length > COMMIT_CAP) {
            toast.error(t('error_too_many_selected', { max: COMMIT_CAP }));
            return;
        }
        await dryRun.run({
            endpoint: `/api/proxy/v1/admin/groups/${groupId}/members`,
            body: { mode: 'dry_run', user_ids: ids },
        });
    };

    const commit = useMutation({
        mutationFn: () => {
            const data = dryRun.data as unknown as (DryRunResult & { bulk_op_id?: string }) | null;
            return bulkAddMembers(groupId, {
                mode: 'commit',
                user_ids: selectedList.map((c) => c.user_id),
                bulk_op_id: data?.bulk_op_id,
                confirmed_count: dryRun.data?.affected,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.groups.members', groupId], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.groups.detail', groupId] });
            qc.invalidateQueries({ queryKey: ['admin.groups.list'], exact: false });
            toast.success(tGroups('saved'));
            setDryRunOpen(false);
            onOpenChange(false);
        },
        onError: (err: Error) => {
            const msg = err.message ?? '';
            if (msg.includes('confirmation_required')) {
                toast.error(msg);
                dryRun.reset();
                setDryRunOpen(false);
                return;
            }
            toast.error(msg || tGroups('error_generic'));
        },
    });

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className='flex w-[680px] flex-col gap-0 sm:max-w-[680px]'>
                    <SheetHeader>
                        <SheetTitle>{t('title')}</SheetTitle>
                        <SheetDescription>
                            {step === 'upload' ? t('upload_description') : t('review_description')}
                        </SheetDescription>
                    </SheetHeader>

                    <div className='flex-1 space-y-4 overflow-auto px-4 pb-4'>
                        {step === 'upload' ? (
                            <UploadStep
                                file={file}
                                parsing={parsing}
                                parsed={parsed}
                                inputRef={inputRef}
                                onFileChange={onFileChange}
                                onDownloadTemplate={onDownloadTemplate}
                            />
                        ) : (
                            <ReviewStep
                                counts={counts}
                                rowsByStatus={rowsByStatus}
                                emptyRows={parsed?.emptyRows ?? 0}
                                isSel={isSel}
                                toggleSel={toggleSel}
                                addSel={addSel}
                                selectedIds={selectedIds}
                            />
                        )}
                    </div>

                    <div className='flex items-center justify-between gap-2 border-t px-4 py-3'>
                        <div className='text-xs text-muted-foreground'>
                            {step === 'review' ? t('selected_count', { count: selectedList.length }) : null}
                        </div>
                        <div className='flex gap-2'>
                            {step === 'review' ? (
                                <Button variant='ghost' onClick={reset}>
                                    {t('back')}
                                </Button>
                            ) : null}
                            <Button variant='outline' onClick={() => onOpenChange(false)}>
                                {tGroups('cancel')}
                            </Button>
                            {step === 'upload' ? (
                                <Button
                                    onClick={() => resolveMutation.mutate()}
                                    disabled={!parsed || parsing || resolveMutation.isPending}
                                >
                                    {resolveMutation.isPending ? t('resolving') : t('resolve')}
                                </Button>
                            ) : (
                                <Button
                                    onClick={onPreview}
                                    disabled={dryRun.status === 'loading' || selectedList.length === 0}
                                >
                                    {dryRun.status === 'loading' ? tGroups('loading') : tGroups('bulk_dry_run')}
                                </Button>
                            )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <DryRunDialog
                open={dryRunOpen}
                onOpenChange={(o) => {
                    setDryRunOpen(o);
                    if (!o) dryRun.reset();
                }}
                result={dryRun.data}
                onConfirm={() => commit.mutate()}
                threshold={50}
            />
        </>
    );
}

// --- Upload step ---

function UploadStep({
    file,
    parsing,
    parsed,
    inputRef,
    onFileChange,
    onDownloadTemplate,
}: {
    file: File | null;
    parsing: boolean;
    parsed: ParsedImport | null;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDownloadTemplate: () => void;
}) {
    const t = useTranslations('admin.groups.import');
    return (
        <div className='space-y-4 pt-4'>
            <div className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
                {t('instructions')}
            </div>

            <div className='flex flex-wrap items-center gap-3'>
                <Button variant='outline' onClick={onDownloadTemplate}>
                    <Download className='mr-2 size-4' />
                    {t('download_template')}
                </Button>

                <input
                    ref={inputRef}
                    type='file'
                    accept={XLSX_ACCEPT}
                    onChange={onFileChange}
                    className='hidden'
                    id='import-members-file'
                />
                <Button asChild variant='secondary'>
                    <label htmlFor='import-members-file' className='cursor-pointer'>
                        <FileSpreadsheet className='mr-2 size-4' />
                        {file ? file.name : t('select_file')}
                    </label>
                </Button>
            </div>

            {parsing ? <p className='text-sm text-muted-foreground'>{t('parsing')}</p> : null}

            {parsed ? (
                <div className='flex flex-wrap gap-2 text-xs'>
                    <Badge variant='secondary'>{t('parsed_rows', { count: parsed.rows.length })}</Badge>
                    {parsed.emptyRows > 0 ? (
                        <Badge variant='muted'>{t('parsed_empty', { count: parsed.emptyRows })}</Badge>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

// --- Review step ---

function ReviewStep({
    counts,
    rowsByStatus,
    emptyRows,
    isSel,
    toggleSel,
    addSel,
    selectedIds,
}: {
    counts: { matched: number; ambiguous: number; unresolved: number };
    rowsByStatus: { matched: ResolveResultRow[]; ambiguous: ResolveResultRow[]; unresolved: ResolveResultRow[] };
    emptyRows: number;
    isSel: (id: number) => boolean;
    toggleSel: (c: StudentCandidate) => void;
    addSel: (c: StudentCandidate) => void;
    selectedIds: Set<number>;
}) {
    const t = useTranslations('admin.groups.import');
    return (
        <div className='space-y-5 pt-4'>
            <div className='flex flex-wrap gap-2 text-xs'>
                <Badge variant='success'>{t('summary_matched', { count: counts.matched })}</Badge>
                <Badge variant='warning'>{t('summary_ambiguous', { count: counts.ambiguous })}</Badge>
                <Badge variant='outline'>{t('summary_unresolved', { count: counts.unresolved })}</Badge>
                {emptyRows > 0 ? <Badge variant='muted'>{t('parsed_empty', { count: emptyRows })}</Badge> : null}
            </div>

            {rowsByStatus.matched.length > 0 ? (
                <section className='space-y-2'>
                    <h4 className='text-sm font-medium'>{t('section_matched')}</h4>
                    <div className='divide-y rounded-md border'>
                        {rowsByStatus.matched.map((row) => {
                            const c = row.candidates[0];
                            if (!c) return null;
                            return (
                                <div key={row.index} className='flex items-start gap-3 p-3'>
                                    <Checkbox
                                        className='mt-1'
                                        checked={isSel(c.user_id)}
                                        disabled={c.in_this_group}
                                        onCheckedChange={() => toggleSel(c)}
                                        aria-label={`select ${c.user_id}`}
                                    />
                                    <CandidateInfo candidate={c} row={row} />
                                </div>
                            );
                        })}
                    </div>
                </section>
            ) : null}

            {rowsByStatus.ambiguous.length > 0 ? (
                <section className='space-y-2'>
                    <h4 className='text-sm font-medium'>{t('section_ambiguous')}</h4>
                    <div className='space-y-2'>
                        {rowsByStatus.ambiguous.map((row) => (
                            <div key={row.index} className='rounded-md border p-3'>
                                <InputLine row={row} />
                                <div className='mt-2 divide-y rounded-md border'>
                                    {row.candidates.map((c) => (
                                        <div key={c.user_id} className='flex items-start gap-3 p-2'>
                                            <Checkbox
                                                className='mt-1'
                                                checked={isSel(c.user_id)}
                                                disabled={c.in_this_group}
                                                onCheckedChange={() => toggleSel(c)}
                                                aria-label={`select ${c.user_id}`}
                                            />
                                            <CandidateInfo candidate={c} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}

            {rowsByStatus.unresolved.length > 0 ? (
                <section className='space-y-2'>
                    <h4 className='text-sm font-medium'>{t('section_unresolved')}</h4>
                    <div className='space-y-2'>
                        {rowsByStatus.unresolved.map((row) => (
                            <div key={row.index} className='rounded-md border p-3'>
                                <div className='flex items-center justify-between gap-2'>
                                    <InputLine row={row} />
                                    <Badge variant={row.status === 'invalid' ? 'destructive' : 'outline'}>
                                        {t(row.status === 'invalid' ? 'badge_invalid' : 'badge_unmatched')}
                                    </Badge>
                                </div>
                                {row.status !== 'invalid' ? (
                                    <ManualSearch selectedIds={selectedIds} onPick={addSel} isSel={isSel} />
                                ) : null}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    );
}

function InputLine({ row }: { row: ResolveResultRow }) {
    const parts = [row.input.name, row.input.phone].filter(Boolean);
    return <div className='text-sm'>{parts.length ? parts.join(' · ') : '—'}</div>;
}

function CandidateInfo({ candidate, row }: { candidate: StudentCandidate; row?: ResolveResultRow }) {
    const t = useTranslations('admin.groups.import');
    // When the student is NOT in this group, every group they belong to is an "other" group.
    const otherGroupNames = candidate.groups.map((g) => g.name).join(', ');
    const showOther = candidate.groups.length > 0 && !candidate.in_this_group;
    return (
        <div className='min-w-0 flex-1 space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
                <span className='text-sm font-medium'>{candidate.full_name ?? '—'}</span>
                <span className='text-xs text-muted-foreground'>{candidate.mobile ?? candidate.email ?? ''}</span>
            </div>
            <div className='flex flex-wrap gap-1.5'>
                {candidate.in_this_group ? <Badge variant='info'>{t('badge_in_this_group')}</Badge> : null}
                {showOther ? (
                    <Badge variant='warning' title={otherGroupNames}>
                        {t('badge_in_other_groups', { count: candidate.groups.length })}
                    </Badge>
                ) : null}
                {candidate.status !== 'active' ? <Badge variant='muted'>{t('badge_inactive')}</Badge> : null}
                {row?.name_mismatch ? <Badge variant='warning'>{t('badge_name_mismatch')}</Badge> : null}
                {row?.duplicate_in_file ? <Badge variant='muted'>{t('badge_duplicate')}</Badge> : null}
            </div>
        </div>
    );
}

function ManualSearch({
    selectedIds,
    onPick,
    isSel,
}: {
    selectedIds: Set<number>;
    onPick: (c: StudentCandidate) => void;
    isSel: (id: number) => boolean;
}) {
    const t = useTranslations('admin.groups.import');
    const tUsers = useTranslations('admin.users');
    const [q, setQ] = useState('');
    const enabled = q.trim().length >= 2;

    const query = useQuery({
        queryKey: ['admin.groups.import.search', q],
        queryFn: () =>
            listUsers({ page: 1, page_size: 8, role_name: 'user', q: q.trim(), sort: 'created_at', order: 'desc' }),
        enabled,
    });
    const rows: UserRow[] = query.data?.rows ?? [];

    const pick = (u: UserRow) =>
        onPick({
            user_id: u.id,
            full_name: u.full_name,
            mobile: u.mobile,
            email: u.email,
            status: u.status,
            in_this_group: false,
            groups: [],
        });

    return (
        <div className='mt-2 space-y-1'>
            <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('search_student')}
                className='h-8'
            />
            {enabled ? (
                <div className='max-h-44 divide-y overflow-auto rounded-md border'>
                    {query.isLoading ? (
                        <div className='p-2 text-xs text-muted-foreground'>{tUsers('loading')}</div>
                    ) : rows.length === 0 ? (
                        <div className='p-2 text-xs text-muted-foreground'>{tUsers('empty')}</div>
                    ) : (
                        rows.map((u) => {
                            const added = isSel(u.id);
                            return (
                                <button
                                    key={u.id}
                                    type='button'
                                    disabled={added}
                                    onClick={() => pick(u)}
                                    className='flex w-full items-center justify-between gap-2 p-2 text-left text-sm hover:bg-accent disabled:opacity-60'
                                >
                                    <span className='min-w-0 truncate'>
                                        {u.full_name ?? '—'}
                                        <span className='ml-2 text-xs text-muted-foreground'>
                                            {u.mobile ?? u.email ?? ''}
                                        </span>
                                    </span>
                                    {added ? <Check className='size-4 shrink-0 text-brand-600' /> : null}
                                </button>
                            );
                        })
                    )}
                </div>
            ) : null}
        </div>
    );
}
