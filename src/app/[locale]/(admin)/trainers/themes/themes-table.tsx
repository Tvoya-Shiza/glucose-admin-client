'use client';

import { MoreHorizontalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TRAINER_PALETTE_LABELS, TRAINER_PALETTE_SWATCHES } from '@/lib/trainers/theme-palettes';
import type { TrainerThemeRow } from '@/lib/trainers/types';

export interface ThemesTableProps {
    rows: TrainerThemeRow[];
    loading: boolean;
    canEdit: boolean;
    onEdit: (row: TrainerThemeRow) => void;
    skeletonRowCount?: number;
}

/** Справочник тем: превью фона, образцы палитры, порядок, видимость. */
export function ThemesTable({ rows, loading, canEdit, onEdit, skeletonRowCount = 8 }: ThemesTableProps) {
    const t = useTranslations('admin.trainers');
    const columnCount = canEdit ? 6 : 5;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className='w-24'>{t('themes_col_preview')}</TableHead>
                    <TableHead>{t('themes_col_title')}</TableHead>
                    <TableHead>{t('themes_col_palette')}</TableHead>
                    <TableHead className='w-24'>{t('themes_col_order')}</TableHead>
                    <TableHead className='w-32'>{t('themes_col_status')}</TableHead>
                    {canEdit ? <TableHead className='w-12'>{t('actions')}</TableHead> : null}
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? Array.from({ length: skeletonRowCount }).map((_, i) => (
                          <TableRow key={`sk-${i}`}>
                              <TableCell colSpan={columnCount}>
                                  <Skeleton className='h-10 w-full' />
                              </TableCell>
                          </TableRow>
                      ))
                    : rows.map((row) => (
                          <TableRow key={row.id}>
                              <TableCell>
                                  {row.image ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={row.image} alt='' className='h-10 w-16 rounded object-cover' />
                                  ) : (
                                      <div className='bg-muted text-muted-foreground flex h-10 w-16 items-center justify-center rounded text-xs'>
                                          {t('themes_no_image')}
                                      </div>
                                  )}
                              </TableCell>
                              <TableCell className='font-medium'>
                                  {row.title}
                                  {row.trainer_count > 0 ? (
                                      <span className='text-muted-foreground ml-2 text-xs'>
                                          {t('themes_used_by', { count: row.trainer_count })}
                                      </span>
                                  ) : null}
                              </TableCell>
                              <TableCell>
                                  <div className='flex items-center gap-2'>
                                      <span className='flex gap-1'>
                                          {(TRAINER_PALETTE_SWATCHES[row.palette] ?? []).map((color) => (
                                              <span
                                                  key={color}
                                                  className='size-4 rounded-full ring-1 ring-black/10'
                                                  style={{ backgroundColor: color }}
                                              />
                                          ))}
                                      </span>
                                      <span className='text-muted-foreground text-xs'>
                                          {TRAINER_PALETTE_LABELS[row.palette] ?? row.palette}
                                      </span>
                                  </div>
                              </TableCell>
                              <TableCell className='tabular-nums'>{row.sort_order}</TableCell>
                              <TableCell>
                                  <Badge variant={row.is_active ? 'default' : 'secondary'}>
                                      {row.is_active ? t('themes_active') : t('themes_hidden')}
                                  </Badge>
                              </TableCell>
                              {canEdit ? (
                                  <TableCell>
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant='ghost' size='icon' aria-label={t('actions')}>
                                                  <MoreHorizontalIcon className='size-4' />
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align='end'>
                                              <DropdownMenuItem onClick={() => onEdit(row)}>{t('themes_edit')}</DropdownMenuItem>
                                          </DropdownMenuContent>
                                      </DropdownMenu>
                                  </TableCell>
                              ) : null}
                          </TableRow>
                      ))}
            </TableBody>
        </Table>
    );
}
