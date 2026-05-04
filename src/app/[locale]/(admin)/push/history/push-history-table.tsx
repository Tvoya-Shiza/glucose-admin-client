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
import { listPushHistory } from '@/lib/push/api';
import type { PushHistoryRow } from '@/lib/push/types';

type SuccessFilter = 'true' | 'false';
type TriggerFilter = 'admin.broadcast' | 'admin.scheduled' | 'admin.test' | 'auto.inactivity';

/**
 * Phase 8 Plan 03 — push history table (PSH-03, D-11).
 *
 * URL-state filters via nuqs: page, page_size, user_id, trigger_type, success,
 * date_from, date_to. Filter changes reset page=1.
 *
 * Columns: sent_at (formatted Asia/Almaty), user (full_name + email), trigger
 * (translated label), category (from meta), status badge, attempt_id (truncated).
 *
 * RBAC scoping happens server-side (PUSH_SCOPE_RULES via PushHistoryService).
 * Curators/teachers see only rows their scope rules surface; admin sees all.
 */
export function PushHistoryTable() {
    const t = useTranslations('admin.push');
    const locale = useLocale() as 'ru' | 'kz';

    const [{ page, page_size, user_id, trigger_type, success, date_from, date_to }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(25),
        user_id: parseAsInteger,
        trigger_type: parseAsStringEnum<TriggerFilter>([
            'admin.broadcast',
            'admin.scheduled',
            'admin.test',
            'auto.inactivity',
        ]),
        success: parseAsStringEnum<SuccessFilter>(['true', 'false']),
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
                'admin.push.history',
                { page, page_size, user_id, trigger_type, success: successBool, date_from, date_to },
            ] as const,
        [page, page_size, user_id, trigger_type, successBool, date_from, date_to],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listPushHistory({
                page,
                page_size,
                user_id: user_id ?? undefined,
                trigger_type: (trigger_type as string | null) ?? undefined,
                success: successBool,
                date_from: date_from ?? undefined,
                date_to: date_to ?? undefined,
            }),
        placeholderData: (prev) => prev,
        staleTime: 60_000,
    });

    const rows: PushHistoryRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive =
        Boolean(user_id) ||
        Boolean(trigger_type) ||
        successBool !== undefined ||
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
                        placeholder={t('history_filter_user_placeholder')}
                        value={user_id ?? ''}
                        onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setQ({ page: 1, user_id: Number.isFinite(v) && v > 0 ? v : null });
                        }}
                    />
                </div>
                <div className='flex flex-col gap-1'>
                    <Label>{t('history_filter_trigger')}</Label>
                    <Select
                        value={trigger_type ?? '__all__'}
                        onValueChange={(v) =>
                            setQ({
                                page: 1,
                                trigger_type: v === '__all__' ? null : (v as TriggerFilter),
                            })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='__all__'>{t('history_filter_trigger_all')}</SelectItem>
                            <SelectItem value='admin.broadcast'>{t('history_filter_trigger_admin_broadcast')}</SelectItem>
                            <SelectItem value='admin.scheduled'>{t('history_filter_trigger_admin_scheduled')}</SelectItem>
                            <SelectItem value='admin.test'>{t('history_filter_trigger_admin_test')}</SelectItem>
                            <SelectItem value='auto.inactivity'>{t('history_filter_trigger_auto_inactivity')}</SelectItem>
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
                            <TableHead>{t('history_col_trigger')}</TableHead>
                            <TableHead>{t('history_col_category')}</TableHead>
                            <TableHead>{t('history_col_status')}</TableHead>
                            <TableHead>{t('history_col_attempt_id')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading
                            ? Array.from({ length: 8 }).map((_, i) => (
                                  <TableRow key={`s-${i}`}>
                                      <TableCell colSpan={6}>
                                          <Skeleton className='h-4 w-full' />
                                      </TableCell>
                                  </TableRow>
                              ))
                            : rows.map((r) => (
                                  <TableRow key={r.id}>
                                      <TableCell className='whitespace-nowrap text-xs'>
                                          {formatUnixSeconds(r.sent_at, locale)}
                                      </TableCell>
                                      <TableCell>
                                          <div className='flex flex-col text-xs'>
                                              <span>{r.user_full_name ?? `#${r.user_id}`}</span>
                                              {r.user_email ? (
                                                  <span className='text-muted-foreground'>{r.user_email}</span>
                                              ) : null}
                                          </div>
                                      </TableCell>
                                      <TableCell className='text-xs'>
                                          {triggerLabel(t, r.trigger_type)}
                                      </TableCell>
                                      <TableCell className='text-xs'>
                                          {r.meta?.category ? t(`category_${r.meta.category}` as 'category_info') : '—'}
                                      </TableCell>
                                      <TableCell>
                                          <StatusBadge success={r.success} t={t} />
                                      </TableCell>
                                      <TableCell className='font-mono text-xs text-muted-foreground'>
                                          {r.meta?.attempt_id ? truncate(r.meta.attempt_id, 12) : '—'}
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
    t: ReturnType<typeof useTranslations<'admin.push'>>;
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

function triggerLabel(t: ReturnType<typeof useTranslations<'admin.push'>>, trigger: string): string {
    const key = (`history_filter_trigger_${trigger.replace('.', '_')}`) as
        | 'history_filter_trigger_admin_broadcast'
        | 'history_filter_trigger_admin_scheduled'
        | 'history_filter_trigger_admin_test'
        | 'history_filter_trigger_auto_inactivity';
    try {
        return t(key);
    } catch {
        return trigger;
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
