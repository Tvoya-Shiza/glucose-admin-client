'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { UseBulkSelectionApi } from '@/hooks/use-bulk-selection';
import { formatUnixSecondsOrDash } from '@/lib/groups/format';
import type { MemberProgressRow, MemberRow } from '@/lib/groups/types';
import { roleLabelKey, statusLabelKey } from '@/lib/users/format';

export interface MembersTableProps {
    rows: MemberRow[];
    progressByUser: Map<number, MemberProgressRow>;
    selection: UseBulkSelectionApi<number>;
    /** Render the selection column only when admin (non-admin can't bulk-remove). */
    canSelect: boolean;
    loading?: boolean;
    skeletonRowCount?: number;
}

/**
 * GRP-03 + GRP-06 — Members table for the group-detail Members tab (Plan 04).
 *
 * Columns:
 *   - Selection checkbox (page-scoped, admin-only). Header checkbox = isPageAllSelected.
 *   - Name (linked to /[locale]/users/[user_id])
 *   - Email
 *   - Role (Badge, localized via `admin.users.role_*` keys — leverages Phase 3 helper)
 *   - Status (Badge, localized via `admin.users.status_*` keys — leverages Phase 3 helper)
 *   - Joined at (Unix-seconds via formatUnixSecondsOrDash)
 *   - Last activity (same; null -> "—")
 *   - Course progress: "Started: X" + "Completed: Y" (lazy-loaded; "—" until loaded)
 *
 * The `useBulkSelection<number>` API takes `{id: number}[]` for `togglePageScoped`/
 * `isPageAllSelected`; we feed it a synthesized `[{id: user_id}]` adapter inline.
 */
export function MembersTable({
    rows,
    progressByUser,
    selection,
    canSelect,
    loading,
    skeletonRowCount = 8,
}: MembersTableProps) {
    const t = useTranslations('admin.groups');
    const tUsers = useTranslations('admin.users');
    const locale = useLocale() as 'ru' | 'kz';

    // Adapter: useBulkSelection's API expects `{ id: TId }[]`. MemberRow uses `user_id`.
    const idRows = rows.map((r) => ({ id: r.user_id }));
    const isPageAllSelected = selection.isPageAllSelected(idRows);

    const colSpan = canSelect ? 8 : 7;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    {canSelect ? (
                        <TableHead className='w-10'>
                            <Checkbox
                                checked={isPageAllSelected}
                                onCheckedChange={() => selection.togglePageScoped(idRows)}
                                aria-label='select page'
                            />
                        </TableHead>
                    ) : null}
                    <TableHead>{tUsers('col_name')}</TableHead>
                    <TableHead>{tUsers('col_email')}</TableHead>
                    <TableHead>{tUsers('col_role')}</TableHead>
                    <TableHead>{tUsers('col_status')}</TableHead>
                    <TableHead>{tUsers('col_created')}</TableHead>
                    <TableHead>{tUsers('col_last_activity')}</TableHead>
                    <TableHead>{t('progress_started', { count: 0 }).split(':')[0]}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? Array.from({ length: skeletonRowCount }).map((_, i) => (
                          <TableRow key={`sk-${i}`}>
                              <TableCell colSpan={colSpan}>
                                  <Skeleton className='h-6 w-full' />
                              </TableCell>
                          </TableRow>
                      ))
                    : rows.map((r) => {
                          const progress = progressByUser.get(r.user_id);
                          return (
                              <TableRow key={r.user_id}>
                                  {canSelect ? (
                                      <TableCell>
                                          <Checkbox
                                              checked={selection.isSelected(r.user_id)}
                                              onCheckedChange={() => selection.toggle(r.user_id)}
                                              aria-label={`select ${r.user_id}`}
                                          />
                                      </TableCell>
                                  ) : null}
                                  <TableCell>
                                      <Link
                                          href={`/${locale}/users/${r.user_id}`}
                                          className='font-medium hover:underline'
                                      >
                                          {r.full_name ?? '—'}
                                      </Link>
                                  </TableCell>
                                  <TableCell className='text-muted-foreground text-sm'>
                                      {r.email ?? '—'}
                                  </TableCell>
                                  <TableCell>
                                      <Badge variant='outline'>{tUsers(roleLabelKey(r.role_name))}</Badge>
                                  </TableCell>
                                  <TableCell>
                                      <Badge
                                          variant={
                                              r.status === 'active'
                                                  ? 'default'
                                                  : r.status === 'pending'
                                                  ? 'secondary'
                                                  : 'outline'
                                          }
                                      >
                                          {tUsers(statusLabelKey(r.status))}
                                      </Badge>
                                  </TableCell>
                                  <TableCell className='text-sm'>
                                      {formatUnixSecondsOrDash(r.joined_at, locale)}
                                  </TableCell>
                                  <TableCell className='text-sm'>
                                      {formatUnixSecondsOrDash(r.last_activity, locale)}
                                  </TableCell>
                                  <TableCell className='text-xs'>
                                      <div>
                                          {t('progress_started', {
                                              count: progress?.courses_started ?? 0,
                                          })}
                                      </div>
                                      <div className='text-muted-foreground'>
                                          {t('progress_completed', {
                                              count: progress?.courses_completed ?? 0,
                                          })}
                                      </div>
                                  </TableCell>
                              </TableRow>
                          );
                      })}
            </TableBody>
        </Table>
    );
}
