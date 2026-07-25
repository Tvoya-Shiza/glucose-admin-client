'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileUploader } from '@/components/ui/file-uploader';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PublisherSelect } from '@/components/ebooks/publisher-select';
import { usePermission } from '@/lib/access/use-permission';
import { updateBook } from '@/lib/ebooks/api';
import type { BookDetail, UpdateBook } from '@/lib/ebooks/types';

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
/** Sentinel for "no grade" — Radix `<Select>` rejects empty-string values. */
const NO_GRADE = '__none__';

/**
 * Phase 39/40 — book Мәліметтер (metadata) tab (ТЗ §6.0).
 *
 * react-hook-form + zod over the PATCH /ebooks/:id surface. Field ranges mirror
 * UpdateBookDto so the UI fails fast: grade 1..11, year 1900..2100, language ≤ 8
 * chars, title ≤ 512, description ≤ 10000.
 *
 * Numeric/optional fields are held as STRINGS in the form and mapped back on
 * submit: '' → null (clear the nullable column), otherwise Number(). That is the
 * update DTO's undefined-vs-null contract — since this form always submits the
 * whole surface, every field is explicitly sent (null clears).
 *
 * `subject_id` is a raw number input rather than a picker: Book.subject_id → the
 * QuizSubject table, but admin-api ships NO quiz-subjects listing endpoint, so
 * there is nothing to populate a dropdown from. `status` is deliberately absent —
 * publication goes through the header's publish button (PATCH :id/publish, which
 * runs the zero-pages gate). `source_file_url` is read-only (import artifact).
 */
const metadataSchema = z.object({
    title: z.string().min(1).max(512),
    description: z.string().max(10000),
    authors: z.string().max(512),
    subject_id: z.string(),
    publisher_id: z.number().int().positive().nullable(),
    grade: z.string(),
    language: z.string().min(1).max(8),
    year: z.string(),
    cover_image: z.string().nullable(),
});

type MetadataValues = z.infer<typeof metadataSchema>;

function toDefaults(book: BookDetail): MetadataValues {
    return {
        title: book.title_kz ?? '',
        description: book.description_kz ?? '',
        authors: book.authors ?? '',
        subject_id: book.subject?.id != null ? String(book.subject.id) : '',
        publisher_id: book.publisher?.id ?? null,
        grade: book.grade != null ? String(book.grade) : '',
        language: book.language || 'kz',
        year: book.year != null ? String(book.year) : '',
        cover_image: book.cover_image,
    };
}

function toNullableInt(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isInteger(n) ? n : null;
}

export function MetadataTab({ book }: { book: BookDetail }) {
    const t = useTranslations('admin.ebooks');
    const qc = useQueryClient();
    const canEdit = usePermission('ebooks.edit');

    const form = useForm<MetadataValues>({
        resolver: zodResolver(metadataSchema),
        defaultValues: toDefaults(book),
        mode: 'onSubmit',
    });

    // Re-seed the form when a fresh detail arrives (e.g. after a successful save
    // invalidation) — updated_at moves on every server write.
    useEffect(() => {
        form.reset(toDefaults(book));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [book.id, book.updated_at]);

    const mutation = useMutation({
        mutationFn: (values: MetadataValues) => {
            const year = toNullableInt(values.year);
            const grade = toNullableInt(values.grade);
            if (year != null && (year < 1900 || year > 2100)) throw new Error(t('year_invalid'));
            if (grade != null && (grade < 1 || grade > 11)) throw new Error(t('grade_invalid'));

            const payload: UpdateBook = {
                title: values.title.trim(),
                description: values.description.trim() === '' ? null : values.description,
                authors: values.authors.trim() === '' ? null : values.authors.trim(),
                subject_id: toNullableInt(values.subject_id),
                publisher_id: values.publisher_id,
                grade,
                language: values.language.trim(),
                year,
                cover_image: values.cover_image,
            };
            return updateBook(book.id, payload);
        },
        onSuccess: (updated) => {
            toast.success(t('save_success'));
            qc.setQueryData(['admin.ebooks.detail', book.id], updated);
            qc.invalidateQueries({ queryKey: ['admin.ebooks.detail', book.id] });
            qc.invalidateQueries({ queryKey: ['admin.ebooks.list'], exact: false });
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='max-w-3xl'>
                <fieldset disabled={!canEdit} className='space-y-4'>
                    {/* ── Негізгі мәліметтер ── */}
                    <Card className='space-y-4 p-5'>
                        <FormField
                            control={form.control}
                            name='title'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('title_label')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder={t('title_placeholder')} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='authors'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('authors_label')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder={t('authors_placeholder')} />
                                    </FormControl>
                                    <FormDescription>{t('authors_hint')}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='description'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('description_label')}</FormLabel>
                                    <FormControl>
                                        <Textarea rows={4} {...field} placeholder={t('description_placeholder')} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </Card>

                    {/* ── Каталог сүзгілері ── */}
                    <Card className='space-y-4 p-5'>
                        <FormField
                            control={form.control}
                            name='publisher_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('publisher_label')}</FormLabel>
                                    <FormControl>
                                        <PublisherSelect
                                            value={field.value}
                                            onChange={(id) => field.onChange(id)}
                                            noneLabel={t('publisher_none')}
                                            disabled={!canEdit}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='subject_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('subject_label')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            inputMode='numeric'
                                            className='max-w-40'
                                            value={field.value ?? ''}
                                            onChange={(e) => field.onChange(e.target.value.replace(/[^\d]/g, ''))}
                                            onBlur={field.onBlur}
                                            ref={field.ref}
                                            name={field.name}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        {book.subject?.title_kz
                                            ? t('subject_current', { title: book.subject.title_kz })
                                            : t('subject_hint')}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                            <FormField
                                control={form.control}
                                name='grade'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('grade_label')}</FormLabel>
                                        <Select
                                            value={field.value === '' ? NO_GRADE : field.value}
                                            onValueChange={(v) => field.onChange(v === NO_GRADE ? '' : v)}
                                            disabled={!canEdit}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('grade_label')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value={NO_GRADE}>{t('grade_none')}</SelectItem>
                                                {GRADES.map((g) => (
                                                    <SelectItem key={g} value={String(g)}>
                                                        {t('grade_value', { grade: g })}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name='language'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('language_label')}</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder='kz' />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name='year'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('year_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='numeric'
                                                placeholder='2024'
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value.replace(/[^\d]/g, ''))}
                                                onBlur={field.onBlur}
                                                ref={field.ref}
                                                name={field.name}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </Card>

                    {/* ── Мұқаба ── */}
                    <Card className='space-y-4 p-5'>
                        <FormField
                            control={form.control}
                            name='cover_image'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('cover_label')}</FormLabel>
                                    <FormControl>
                                        <FileUploader
                                            kind='cover'
                                            variant='inline'
                                            value={field.value}
                                            onChange={(url) => field.onChange(url)}
                                            onClear={() => field.onChange(null)}
                                            disabled={!canEdit}
                                            pickFromLibrary
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {book.source_file_url ? (
                            <div className='text-muted-foreground text-xs'>
                                {t('source_file_label')}: <span className='break-all'>{book.source_file_url}</span>
                            </div>
                        ) : null}
                    </Card>

                    {canEdit ? (
                        <div className='flex justify-end gap-2'>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => form.reset(toDefaults(book))}
                                disabled={mutation.isPending}
                            >
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('loading') : t('save')}
                            </Button>
                        </div>
                    ) : null}
                </fieldset>
            </form>
        </Form>
    );
}
