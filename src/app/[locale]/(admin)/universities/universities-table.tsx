'use client';

import Link from 'next/link';
import { MoreHorizontalIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { UniversityListRow } from '@/lib/universities/types';

interface Props {
    rows: UniversityListRow[];
    loading: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onEdit: (row: UniversityListRow) => void;
    onDelete: (row: UniversityListRow) => void;
    skeletonRowCount?: number;
}

export function UniversitiesTable({ rows, loading, canEdit, canDelete, onEdit, onDelete, skeletonRowCount = 8 }: Props) {
    const t = useTranslations('universities');
    const locale = useLocale();

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className='w-[140px]'>{t('col_unik')}</TableHead>
                    <TableHead>{t('col_title')}</TableHead>
                    <TableHead className='w-[180px]'>{t('col_city')}</TableHead>
                    <TableHead className='w-[120px]'>{t('col_specialties')}</TableHead>
                    <TableHead className='w-[160px]'>{t('col_flags')}</TableHead>
                    <TableHead className='w-[64px] text-right'>{t('col_actions')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? Array.from({ length: skeletonRowCount }).map((_, i) => (
                          <TableRow key={`sk-${i}`}>
                              <TableCell><Skeleton className='h-4 w-20' /></TableCell>
                              <TableCell><Skeleton className='h-4 w-64' /></TableCell>
                              <TableCell><Skeleton className='h-4 w-24' /></TableCell>
                              <TableCell><Skeleton className='h-4 w-10' /></TableCell>
                              <TableCell><Skeleton className='h-4 w-24' /></TableCell>
                              <TableCell></TableCell>
                          </TableRow>
                      ))
                    : rows.map((row) => (
                          <TableRow key={row.id}>
                              <TableCell className='font-mono text-xs'>{row.unik}</TableCell>
                              <TableCell>
                                  <Link
                                      href={`/${locale}/universities/${row.id}`}
                                      className='font-medium hover:underline'
                                  >
                                      {row.title_kk}
                                  </Link>
                                  {row.email ? (
                                      <div className='text-xs text-muted-foreground'>{row.email}</div>
                                  ) : null}
                              </TableCell>
                              <TableCell>
                                  {row.city_title_kk ?? <span className='text-muted-foreground'>—</span>}
                              </TableCell>
                              <TableCell>
                                  <Badge variant='secondary'>{row.specialty_count}</Badge>
                              </TableCell>
                              <TableCell className='space-x-1'>
                                  {row.has_dormitory ? <Badge variant='outline'>{t('badge_dormitory')}</Badge> : null}
                                  {row.has_military_department ? (
                                      <Badge variant='outline'>{t('badge_military')}</Badge>
                                  ) : null}
                              </TableCell>
                              <TableCell className='text-right'>
                                  {canEdit || canDelete ? (
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant='ghost' size='icon'>
                                                  <MoreHorizontalIcon className='size-4' />
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align='end'>
                                              <DropdownMenuItem asChild>
                                                  <Link href={`/${locale}/universities/${row.id}`}>{t('action_open')}</Link>
                                              </DropdownMenuItem>
                                              {canEdit ? (
                                                  <DropdownMenuItem onSelect={() => onEdit(row)}>
                                                      {t('action_edit')}
                                                  </DropdownMenuItem>
                                              ) : null}
                                              {canDelete ? (
                                                  <DropdownMenuItem
                                                      className='text-destructive focus:text-destructive'
                                                      onSelect={() => onDelete(row)}
                                                  >
                                                      {t('action_delete')}
                                                  </DropdownMenuItem>
                                              ) : null}
                                          </DropdownMenuContent>
                                      </DropdownMenu>
                                  ) : null}
                              </TableCell>
                          </TableRow>
                      ))}
            </TableBody>
        </Table>
    );
}
