'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/users/empty-state';
import { listMailingHistory } from '@/lib/mailings/api';
import type { MailingCategory, MailingHistoryRow } from '@/lib/mailings/types';

type SuccessFilter = 'true' | 'false';

/**
 * Phase 8 Plan 05 — mailings history table (PSH-06, D-16).
 *
 * URL-state filters via nuqs: page, page_size, user_id, subject, success,
 * category, date_from, date_to. Filter changes reset page=1.
 *
 * Columns: sent_at (formatted Asia/Almaty), user (full_name) + to_email,
 * subject (truncated), category (translated), status badge, error (truncated).
 *
 * RBAC scoping: admin-only at admin-api (D-19). Curator/teacher see 403 from
 * the BFF call and we render an empty state with the error message.
 */
export function MailingsHistoryTable() {
    const t = useTranslations('admin.mailings');
    const locale = useLocale() as 'ru' | 'kz';

    const [{ page, page_size, user_id, subject, success, category, date_from, date_to }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(25),
        user_id: parseAsInteger,
        subject: parseAsString,
        success: parseAsStringEnum<SuccessFilter>(['true', 'false']),
        category: parseAsStringEnum<MailingCategory>(['marketing', 'transactional', 'reminder', 'system']),
        date_from: parseAsInteger,
        date_to: parseAsInteger,
        // sort/order are not user-configurable in v1.
        sort: parseAsString.withDefault('sent_at'),
        order: parseAsString.withDefault('desc'),
    });

    const successBool: boolean | undefined =
        success === 'true' ? true : success === 'false' ? false : undefined;

    const queryKey = useMemo(
        () =>
            [
                'admin.mailings.history',
                {
                    page,
                    page_size,
                    user_id,
                    subject,
                    success: successBool,
                    category,
                    date_from,
                    date_to,
                },
            ] as const,
        [page, page_size, user_id, subject, successBool, category, date_from, date_to],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listMailingHistory({
                page,
                page_size,
                user_id: user_id ?? undefined,
                subject: subject ?? undefined,
                success: successBool,
                category: (category as MailingCategory | null) ?? undefined,
                date_from: date_from ?? undefined,
                date_to: date_to ?? undefined,
            }),
        placeholderData: (prev) => prev,
        staleTime: 60_000,
    });

    const rows: MailingHistoryRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive =
        Boolean(user_id) ||
        Boolean(subject) ||
        successBool !== undefined ||
        Boolean(category) ||
        Boolean(date_from) ||
        Boolean(date_to);

    return (
        <div className='flex flex-col gap-4'>
            {/* Filters */}
            <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
                <div className='flex flex-col gap-1'>
                    <Label htmlFor='filter_user_id'>{t('history_filter_user_label')}</Label>
                    <Input
                        id='filter_user_id'
                        type='number'
                        inputMode='numeric'
                        value={user_id ?? ''}
                        onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setQ({ page: 1, user_id: Number.isFinite(v) && v > 0 ? v : null });
                        }}
                    />
                </div>
                <div className='flex flex-col gap-1'>
                    <Label htmlFor='filter_subject'>{t('history_filter_subject_label')}</Label>
                    <Input
                        id='filter_subject'
                        value={subject ?? ''}
                        onChange={(e) => setQ({ page: 1, subject: e.target.value || null })}
                    />
                </div>
                <div className='flex flex-col gap-1'>
                    <Label>{t('category_label')}</Label>
                    <Select
                        value={category ?? '__all__'}
                        onValueChange={(v) =>
                            setQ({
                                page: 1,
                                category: v === '__all__' ? null : (v as MailingCategory),
                            })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='__all__'>{t('history_filter_status_all')}</SelectItem>
                            <SelectItem value='marketing'>{t('category_marketing')}</SelectItem>
                            <SelectItem value='transactional'>{t('category_transactional')}</SelectItem>
                            <SelectItem value='reminder'>{t('category_reminder')}</SelectItem>
                            <SelectItem value='system'>{t('category_system')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className='flex flex-col gap-1'>
                    <Label>{t('history_filter_status')}</Label>
                    <Select
                        value={success ?? '__all__'}
                        onValueChange={(v) =>
                            setQ({ page: 1, success: v === '__all__' ? null : (v as SuccessFilter) })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='__all__'>{t('history_filter_status_all')}</SelectItem>
                            <SelectItem value='true'>{t('history_filter_status_success')}</SelectItem>
                            <SelectItem value='false'>{t('history_filter_status_failed')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className='flex flex-col gap-1'>
                    <Label htmlFor='filter_date_from'>{t('history_filter_date_from')}</Label>
                    <Input
                        id='filter_date_from'
                        type='date'
                        value={date_from ? unixToInputDate(date_from) : ''}
                        onChange={(e) => {
                            const unix = inputDateToUnix(e.target.value);
                            setQ({ page: 1, date_from: unix });
                        }}
                    />
                </div>
                <div className='flex flex-col gap-1'>
                    <Label htmlFor='filter_date_to'>{t('history_filter_date_to')}</Label>
                    <Input
                        id='filter_date_to'
                        type='date'
                        value={date_to ? unixToInputDate(date_to) : ''}
                        onChange={(e) => {
                            const unix = inputDateToUnix(e.target.value);
                            setQ({ page: 1, date_to: unix });
                        }}
                    />
                </div>
            </div>

            {/* Table */}
            {error ? (
                <EmptyState title={(error as Error).message} />
            ) : !isLoading && rows.length === 0 ? (
                <EmptyState title={anyFilterActive ? t('history_empty_filtered') : t('history_empty')} />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('history_col_sent_at')}</TableHead>
                            <TableHead>{t('history_col_user')}</TableHead>
                            <TableHead>{t('history_col_to_email')}</TableHead>
                            <TableHead>{t('history_col_subject')}</TableHead>
                            <TableHead>{t('history_col_category')}</TableHead>
                            <TableHead>{t('history_col_status')}</TableHead>
                            <TableHead>{t('history_col_error')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading
                            ? Array.from({ length: 8 }).map((_, i) => (
                                  <TableRow key={`s-${i}`}>
                                      <TableCell colSpan={7}>
                                          <Skeleton className='h-4 w-full' />
                                      </TableCell>
                                  </TableRow>
                              ))
                            : rows.map((r) => (
                                  <TableRow key={r.id}>
                                      <TableCell className='whitespace-nowrap text-xs'>
                                          {formatUnixSeconds(r.sent_at, locale)}
                                      </TableCell>
                                      <TableCell className='text-xs'>
                                          {r.user_full_name ?? `#${r.user_id}`}
                                      </TableCell>
                                      <TableCell className='text-muted-foreground text-xs'>
                                          {r.to_email}
                                      </TableCell>
                                      <TableCell className='text-xs' title={r.subject}>
                                          {truncate(r.subject, 60)}
                                      </TableCell>
                                      <TableCell className='text-xs'>
                                          {categoryLabel(t, r.category)}
                                      </TableCell>
                                      <TableCell>
                                          <StatusBadge success={r.success} t={t} />
                                      </TableCell>
                                      <TableCell
                                          className='font-mono text-xs text-muted-foreground'
                                          title={r.error ?? ''}
                                      >
                                          {r.error ? truncate(r.error, 40) : '—'}
                                      </TableCell>
                                  </TableRow>
                              ))}
                    </TableBody>
                </Table>
            )}

            {/* Pagination */}
            <footer className='flex items-center justify-between border-t pt-3 text-sm'>
                <span className='text-muted-foreground'>{isFetching ? '…' : total}</span>
                <div className='flex items-center gap-2'>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={page <= 1}
                        onClick={() => setQ({ page: page - 1 })}
                    >
                        ‹
                    </Button>
                    <span className='tabular-nums'>{page}</span>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={rows.length < page_size}
                        onClick={() => setQ({ page: page + 1 })}
                    >
                        ›
                    </Button>
                </div>
            </footer>
        </div>
    );
}

function StatusBadge({
    success,
    t,
}: {
    success: boolean;
    t: ReturnType<typeof useTranslations<'admin.mailings'>>;
}) {
    return (
        <Badge variant={success ? 'default' : 'destructive'}>
            {success ? t('history_status_success') : t('history_status_failed')}
        </Badge>
    );
}

function formatUnixSeconds(unix: number, locale: 'ru' | 'kz'): string {
    const lang = locale === 'kz' ? 'kk-KZ' : 'ru-RU';
    return new Intl.DateTimeFormat(lang, {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Asia/Almaty',
    }).format(new Date(unix * 1000));
}

function categoryLabel(
    t: ReturnType<typeof useTranslations<'admin.mailings'>>,
    category: string,
): string {
    const key = `category_${category}` as
        | 'category_marketing'
        | 'category_transactional'
        | 'category_reminder'
        | 'category_system';
    try {
        return t(key);
    } catch {
        return category;
    }
}

function truncate(s: string, n: number): string {
    return s.length > n ? `${s.slice(0, n)}…` : s;
}

function unixToInputDate(unix: number): string {
    const d = new Date(unix * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function inputDateToUnix(s: string): number | null {
    if (!s) return null;
    const t = Date.parse(`${s}T00:00:00Z`);
    if (Number.isNaN(t)) return null;
    return Math.floor(t / 1000);
}
