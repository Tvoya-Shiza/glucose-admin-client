'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { EmptyState } from '@/components/admin/empty-state';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { usePermission } from '@/lib/access/use-permission';
import {
    deleteAdmissionStat,
    deleteUniversity,
    getUniversity,
    linkSpecialty,
    listAdmissionStats,
    listSpecialties,
    listUniversitySpecialties,
    unlinkSpecialty,
    updateUniversitySpecialty,
    upsertAdmissionStat,
} from '@/lib/universities/api';
import type {
    AdmissionStatRow,
    SpecialtyListRow,
    UniversitySpecialtyRow,
} from '@/lib/universities/types';
import { UpsertUniversityDialog } from '../components/upsert-university-dialog';

interface Props {
    id: number;
}

export function UniversityDetailClient({ id }: Props) {
    const t = useTranslations('universities');
    const tDet = useTranslations('universities.detail');
    const locale = useLocale();
    const qc = useQueryClient();

    const canEdit = usePermission('universities.edit');
    const canDelete = usePermission('universities.delete');
    const canLink = usePermission('specialties.edit');
    const canStatsEdit = usePermission('admission_stats.edit');

    const detail = useQuery({
        queryKey: ['admin.universities.detail', String(id)],
        queryFn: () => getUniversity(id),
    });

    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const deleteMutation = useMutation({
        mutationFn: () => deleteUniversity(id),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['admin.universities.list'] });
            toast.success(t('deleted_toast'));
            setDeleteOpen(false);
            window.location.href = `/${locale}/universities`;
        },
        onError: (e: Error) => toast.error(e.message || t('error_generic')),
    });

    return (
        <PageShell
            header={
                <PageHeader
                    title={detail.data?.title_kk ?? t('detail_title_loading')}
                    subtitle={
                        detail.data ? (
                            <span className='font-mono text-xs'>{detail.data.unik}</span>
                        ) : null
                    }
                    actions={
                        <div className='flex items-center gap-2'>
                            <Button variant='outline' size='sm' asChild>
                                <Link href={`/${locale}/universities`}>
                                    <ChevronLeft className='mr-1 size-4' />
                                    {t('back_to_list')}
                                </Link>
                            </Button>
                            {canEdit && detail.data ? (
                                <Button variant='outline' size='sm' onClick={() => setEditOpen(true)}>
                                    <Pencil className='mr-1 size-4' />
                                    {t('action_edit')}
                                </Button>
                            ) : null}
                            {canDelete ? (
                                <Button variant='destructive' size='sm' onClick={() => setDeleteOpen(true)}>
                                    <Trash2 className='mr-1 size-4' />
                                    {t('action_delete')}
                                </Button>
                            ) : null}
                        </div>
                    }
                />
            }
            contentClassName='space-y-4'
        >
            {detail.isLoading ? (
                <Card className='p-6'>
                    <Skeleton className='mb-4 h-6 w-64' />
                    <Skeleton className='h-4 w-full' />
                </Card>
            ) : detail.error || !detail.data ? (
                <EmptyState icon={Pencil} title={t('error_generic')} subtitle={(detail.error as Error)?.message} />
            ) : (
                <Tabs defaultValue='general'>
                    <TabsList>
                        <TabsTrigger value='general'>{tDet('tab_general')}</TabsTrigger>
                        <TabsTrigger value='specialties'>
                            {tDet('tab_specialties')} ({detail.data.specialty_count})
                        </TabsTrigger>
                        <TabsTrigger value='admission'>{tDet('tab_admission')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value='general' className='mt-4 space-y-4'>
                        <Card className='p-6'>
                            <dl className='grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2'>
                                <Field label={tDet('field_city')}>{detail.data.city_title_kk ?? '—'}</Field>
                                <Field label={tDet('field_address')}>{detail.data.address ?? '—'}</Field>
                                <Field label={tDet('field_website')}>
                                    {detail.data.website ? (
                                        <a
                                            href={detail.data.website}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='text-primary underline'
                                        >
                                            {detail.data.website}
                                        </a>
                                    ) : (
                                        '—'
                                    )}
                                </Field>
                                <Field label={tDet('field_email')}>{detail.data.email ?? '—'}</Field>
                                <Field label={tDet('field_phone')}>{detail.data.phone ?? '—'}</Field>
                                <Field label={tDet('field_instagram')}>{detail.data.instagram ?? '—'}</Field>
                                <Field label={tDet('field_dormitory')}>
                                    {detail.data.has_dormitory ? (
                                        <Badge variant='default'>{t('has_dormitory_yes')}</Badge>
                                    ) : (
                                        <Badge variant='secondary'>{t('has_dormitory_no')}</Badge>
                                    )}
                                </Field>
                                <Field label={tDet('field_military')}>
                                    {detail.data.has_military_department ? (
                                        <Badge variant='default'>{t('has_military_yes')}</Badge>
                                    ) : (
                                        <Badge variant='secondary'>{t('has_military_no')}</Badge>
                                    )}
                                </Field>
                            </dl>
                            {detail.data.short_desc_kk ? (
                                <div className='mt-6'>
                                    <div className='mb-1 text-xs font-medium uppercase text-muted-foreground'>
                                        {tDet('field_short_desc')}
                                    </div>
                                    <p className='text-sm leading-relaxed'>{detail.data.short_desc_kk}</p>
                                </div>
                            ) : null}
                            {detail.data.full_desc_kk ? (
                                <div className='mt-6'>
                                    <div className='mb-1 text-xs font-medium uppercase text-muted-foreground'>
                                        {tDet('field_full_desc')}
                                    </div>
                                    <p className='whitespace-pre-line text-sm leading-relaxed'>
                                        {detail.data.full_desc_kk}
                                    </p>
                                </div>
                            ) : null}
                        </Card>
                    </TabsContent>
                    <TabsContent value='specialties' className='mt-4'>
                        <SpecialtiesTab universityId={id} canLink={canLink} />
                    </TabsContent>
                    <TabsContent value='admission' className='mt-4'>
                        <AdmissionTab universityId={id} canEdit={canStatsEdit} />
                    </TabsContent>
                </Tabs>
            )}

            <UpsertUniversityDialog open={editOpen} onOpenChange={setEditOpen} university={detail.data ?? null} />

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('delete_title')}</DialogTitle>
                        <DialogDescription>
                            {t('delete_description', { name: detail.data?.title_kk ?? '' })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setDeleteOpen(false)}>
                            {t('cancel')}
                        </Button>
                        <Button
                            variant='destructive'
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate()}
                        >
                            {deleteMutation.isPending ? t('deleting') : t('action_delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <dt className='text-xs font-medium uppercase text-muted-foreground'>{label}</dt>
            <dd className='mt-1 text-sm'>{children}</dd>
        </div>
    );
}

// ---------- Specialties tab ----------

function SpecialtiesTab({ universityId, canLink }: { universityId: number; canLink: boolean }) {
    const t = useTranslations('universities.detail');
    const qc = useQueryClient();

    const links = useQuery({
        queryKey: ['admin.universities.specialties', String(universityId)],
        queryFn: () => listUniversitySpecialties(universityId),
    });

    const [linkOpen, setLinkOpen] = useState(false);
    const [editLink, setEditLink] = useState<UniversitySpecialtyRow | null>(null);

    const unlink = useMutation({
        mutationFn: (id: number) => unlinkSpecialty(universityId, id),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['admin.universities.specialties', String(universityId)] });
            await qc.invalidateQueries({ queryKey: ['admin.universities.detail', String(universityId)] });
            toast.success(t('unlink_toast'));
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <div className='space-y-4'>
            {canLink ? (
                <div className='flex justify-end'>
                    <Button size='sm' onClick={() => setLinkOpen(true)}>
                        {t('link_specialty')}
                    </Button>
                </div>
            ) : null}
            <Card className='overflow-hidden p-0'>
                {links.isLoading ? (
                    <div className='p-6'>
                        <Skeleton className='h-4 w-64' />
                    </div>
                ) : (links.data ?? []).length === 0 ? (
                    <EmptyState icon={Pencil} title={t('no_specialties')} />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className='w-[140px]'>{t('col_code')}</TableHead>
                                <TableHead>{t('col_title')}</TableHead>
                                <TableHead className='w-[150px]'>{t('col_rural')}</TableHead>
                                <TableHead className='w-[100px]'>{t('col_stats')}</TableHead>
                                <TableHead className='w-[140px] text-right'>{t('col_actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(links.data ?? []).map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className='font-mono text-xs'>{row.specialty_code}</TableCell>
                                    <TableCell>{row.specialty_title_kk}</TableCell>
                                    <TableCell>
                                        {row.has_rural_quota ? (
                                            <Badge variant='default'>{t('rural_yes')}</Badge>
                                        ) : (
                                            <Badge variant='secondary'>{t('rural_no')}</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant='outline'>{row.admission_stats_count}</Badge>
                                    </TableCell>
                                    <TableCell className='text-right'>
                                        {canLink ? (
                                            <div className='flex justify-end gap-2'>
                                                <Button variant='ghost' size='sm' onClick={() => setEditLink(row)}>
                                                    {t('edit')}
                                                </Button>
                                                <Button
                                                    variant='ghost'
                                                    size='sm'
                                                    onClick={() => unlink.mutate(row.id)}
                                                    disabled={unlink.isPending}
                                                    className='text-destructive hover:text-destructive'
                                                >
                                                    {t('unlink')}
                                                </Button>
                                            </div>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            <LinkSpecialtyDialog
                open={linkOpen || editLink !== null}
                onOpenChange={(o) => {
                    if (!o) {
                        setLinkOpen(false);
                        setEditLink(null);
                    }
                }}
                universityId={universityId}
                link={editLink}
            />
        </div>
    );
}

function LinkSpecialtyDialog({
    open,
    onOpenChange,
    universityId,
    link,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    universityId: number;
    link: UniversitySpecialtyRow | null;
}) {
    const t = useTranslations('universities.detail');
    const qc = useQueryClient();

    const [specialtyId, setSpecialtyId] = useState<number | null>(link?.specialty_id ?? null);
    const [hasRural, setHasRural] = useState<boolean>(link?.has_rural_quota ?? false);
    const [shortDesc, setShortDesc] = useState<string>(link?.short_desc_kk ?? '');
    const [fullDesc, setFullDesc] = useState<string>(link?.full_desc_kk ?? '');
    const [q, setQ] = useState('');

    useMemo(() => {
        setSpecialtyId(link?.specialty_id ?? null);
        setHasRural(link?.has_rural_quota ?? false);
        setShortDesc(link?.short_desc_kk ?? '');
        setFullDesc(link?.full_desc_kk ?? '');
    }, [link]);

    const directory = useQuery({
        queryKey: ['admin.specialties.directory', q],
        queryFn: () => listSpecialties({ q: q || undefined, page: 1, page_size: 50 }),
        enabled: open && link === null,
    });

    const save = useMutation({
        mutationFn: async () => {
            const payload = {
                specialty_id: specialtyId ?? undefined,
                has_rural_quota: hasRural,
                short_desc_kk: shortDesc || null,
                full_desc_kk: fullDesc || null,
            };
            if (link) return updateUniversitySpecialty(universityId, link.id, payload);
            if (!specialtyId) throw new Error('specialty_required');
            return linkSpecialty(universityId, payload);
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['admin.universities.specialties', String(universityId)] });
            await qc.invalidateQueries({ queryKey: ['admin.universities.detail', String(universityId)] });
            toast.success(t(link ? 'updated_toast' : 'linked_toast'));
            onOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{link ? t('edit_link') : t('link_specialty')}</DialogTitle>
                </DialogHeader>
                <div className='space-y-4'>
                    {!link ? (
                        <div className='space-y-2'>
                            <Label>{t('specialty_search')}</Label>
                            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('specialty_search_placeholder')} />
                            <div className='max-h-48 space-y-1 overflow-auto rounded border p-2'>
                                {(directory.data?.rows ?? []).map((s: SpecialtyListRow) => (
                                    <button
                                        type='button'
                                        key={s.id}
                                        className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${
                                            specialtyId === s.id ? 'bg-muted font-medium' : ''
                                        }`}
                                        onClick={() => setSpecialtyId(s.id)}
                                    >
                                        <span className='font-mono text-xs'>{s.code}</span> — {s.title_kk}
                                    </button>
                                ))}
                                {directory.data?.rows.length === 0 ? (
                                    <div className='px-2 py-1 text-xs text-muted-foreground'>{t('no_results')}</div>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <div className='space-y-1'>
                            <Label>{t('specialty')}</Label>
                            <div className='rounded border bg-muted px-3 py-2 text-sm'>
                                <span className='font-mono'>{link.specialty_code}</span> — {link.specialty_title_kk}
                            </div>
                        </div>
                    )}
                    <label className='flex items-center gap-2 text-sm'>
                        <Checkbox checked={hasRural} onCheckedChange={(v) => setHasRural(!!v)} />
                        {t('has_rural_quota')}
                    </label>
                    <div className='space-y-1'>
                        <Label>{t('short_desc')}</Label>
                        <Textarea rows={2} value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} />
                    </div>
                    <div className='space-y-1'>
                        <Label>{t('full_desc')}</Label>
                        <Textarea rows={4} value={fullDesc} onChange={(e) => setFullDesc(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                        {save.isPending ? t('saving') : t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------- Admission stats tab ----------

function AdmissionTab({ universityId, canEdit }: { universityId: number; canEdit: boolean }) {
    const t = useTranslations('universities.detail');
    const qc = useQueryClient();

    const stats = useQuery({
        queryKey: ['admin.admission_stats.list', { university_id: universityId }],
        queryFn: () => listAdmissionStats({ university_id: universityId, page: 1, page_size: 500 }),
    });
    const links = useQuery({
        queryKey: ['admin.universities.specialties', String(universityId)],
        queryFn: () => listUniversitySpecialties(universityId),
    });

    const [open, setOpen] = useState(false);
    const [editRow, setEditRow] = useState<AdmissionStatRow | null>(null);

    const remove = useMutation({
        mutationFn: (id: number) => deleteAdmissionStat(id),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['admin.admission_stats.list', { university_id: universityId }] });
            toast.success(t('stat_deleted'));
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <div className='space-y-4'>
            {canEdit ? (
                <div className='flex justify-end'>
                    <Button size='sm' onClick={() => setOpen(true)}>
                        {t('add_stat')}
                    </Button>
                </div>
            ) : null}
            <Card className='overflow-hidden p-0'>
                {stats.isLoading ? (
                    <div className='p-6'>
                        <Skeleton className='h-4 w-64' />
                    </div>
                ) : (stats.data?.rows ?? []).length === 0 ? (
                    <EmptyState icon={Pencil} title={t('no_stats')} />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className='w-[120px]'>{t('col_specialty_code')}</TableHead>
                                <TableHead className='w-[80px]'>{t('col_year')}</TableHead>
                                <TableHead className='w-[100px]'>{t('col_grants')}</TableHead>
                                <TableHead className='w-[110px]'>{t('col_threshold')}</TableHead>
                                <TableHead className='w-[140px]'>{t('col_threshold_rural')}</TableHead>
                                <TableHead className='w-[120px] text-right'>{t('col_actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(stats.data?.rows ?? []).map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className='font-mono text-xs'>{row.specialty_code}</TableCell>
                                    <TableCell>{row.year}</TableCell>
                                    <TableCell>{row.grants_count ?? '—'}</TableCell>
                                    <TableCell>{row.threshold ?? '—'}</TableCell>
                                    <TableCell>{row.threshold_rural ?? '—'}</TableCell>
                                    <TableCell className='text-right'>
                                        {canEdit ? (
                                            <div className='flex justify-end gap-2'>
                                                <Button variant='ghost' size='sm' onClick={() => setEditRow(row)}>
                                                    {t('edit')}
                                                </Button>
                                                <Button
                                                    variant='ghost'
                                                    size='sm'
                                                    onClick={() => remove.mutate(row.id)}
                                                    className='text-destructive hover:text-destructive'
                                                >
                                                    {t('delete')}
                                                </Button>
                                            </div>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            <UpsertAdmissionDialog
                open={open || editRow !== null}
                onOpenChange={(o) => {
                    if (!o) {
                        setOpen(false);
                        setEditRow(null);
                    }
                }}
                links={links.data ?? []}
                stat={editRow}
            />
        </div>
    );
}

function UpsertAdmissionDialog({
    open,
    onOpenChange,
    links,
    stat,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    links: UniversitySpecialtyRow[];
    stat: AdmissionStatRow | null;
}) {
    const t = useTranslations('universities.detail');
    const qc = useQueryClient();
    const currentYear = new Date().getFullYear();

    const [linkId, setLinkId] = useState<number | null>(stat?.university_specialty_id ?? null);
    const [year, setYear] = useState<number>(stat?.year ?? currentYear);
    const [grants, setGrants] = useState<string>(stat?.grants_count?.toString() ?? '');
    const [threshold, setThreshold] = useState<string>(stat?.threshold?.toString() ?? '');
    const [thresholdRural, setThresholdRural] = useState<string>(stat?.threshold_rural?.toString() ?? '');

    useMemo(() => {
        setLinkId(stat?.university_specialty_id ?? null);
        setYear(stat?.year ?? currentYear);
        setGrants(stat?.grants_count?.toString() ?? '');
        setThreshold(stat?.threshold?.toString() ?? '');
        setThresholdRural(stat?.threshold_rural?.toString() ?? '');
    }, [stat, currentYear]);

    const save = useMutation({
        mutationFn: async () => {
            if (!linkId) throw new Error('link_required');
            return upsertAdmissionStat({
                university_specialty_id: linkId,
                year,
                grants_count: grants === '' ? null : Number(grants),
                threshold: threshold === '' ? null : Number(threshold),
                threshold_rural: thresholdRural === '' ? null : Number(thresholdRural),
            });
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['admin.admission_stats.list'] });
            toast.success(t('stat_saved'));
            onOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{stat ? t('edit_stat') : t('add_stat')}</DialogTitle>
                </DialogHeader>
                <div className='space-y-3'>
                    <div className='space-y-1'>
                        <Label>{t('specialty')}</Label>
                        <select
                            className='w-full rounded border bg-background px-3 py-2 text-sm'
                            value={linkId ?? ''}
                            onChange={(e) => setLinkId(e.target.value === '' ? null : Number(e.target.value))}
                            disabled={stat !== null}
                        >
                            <option value=''>{t('select_specialty')}</option>
                            {links.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.specialty_code} — {l.specialty_title_kk}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className='grid grid-cols-2 gap-3'>
                        <div className='space-y-1'>
                            <Label>{t('year')}</Label>
                            <Input
                                type='number'
                                value={year}
                                min={2021}
                                max={currentYear + 1}
                                onChange={(e) => setYear(Number(e.target.value))}
                                disabled={stat !== null}
                            />
                        </div>
                        <div className='space-y-1'>
                            <Label>{t('grants_count')}</Label>
                            <Input type='number' value={grants} onChange={(e) => setGrants(e.target.value)} />
                        </div>
                        <div className='space-y-1'>
                            <Label>{t('threshold')}</Label>
                            <Input type='number' value={threshold} onChange={(e) => setThreshold(e.target.value)} />
                        </div>
                        <div className='space-y-1'>
                            <Label>{t('threshold_rural')}</Label>
                            <Input
                                type='number'
                                value={thresholdRural}
                                onChange={(e) => setThresholdRural(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                        {save.isPending ? t('saving') : t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
