'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { createUniversity, updateUniversity } from '@/lib/universities/api';
import type { UniversityDetail, UpsertUniversityPayload } from '@/lib/universities/types';

const schema = z.object({
    unik: z.string().min(1, 'unik_required').max(32).regex(/^[A-Za-z0-9._-]+$/),
    title_kk: z.string().min(1, 'title_kk_required').max(255),
    city_id: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().int().min(1).nullable().optional()),
    website: z.string().max(255).optional().or(z.literal('')),
    phone: z.string().max(64).optional().or(z.literal('')),
    email: z.string().email().max(160).optional().or(z.literal('')),
    instagram: z.string().max(120).optional().or(z.literal('')),
    address: z.string().max(255).optional().or(z.literal('')),
    has_dormitory: z.boolean().optional(),
    has_military_department: z.boolean().optional(),
    short_desc_kk: z.string().max(1024).optional().or(z.literal('')),
    full_desc_kk: z.string().max(65535).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    university: UniversityDetail | null;
}

function toPayload(values: FormValues): UpsertUniversityPayload {
    return {
        unik: values.unik,
        title_kk: values.title_kk,
        city_id: (values.city_id ?? null) as number | null,
        website: values.website || null,
        phone: values.phone || null,
        email: values.email || null,
        instagram: values.instagram || null,
        address: values.address || null,
        has_dormitory: !!values.has_dormitory,
        has_military_department: !!values.has_military_department,
        short_desc_kk: values.short_desc_kk || null,
        full_desc_kk: values.full_desc_kk || null,
    };
}

export function UpsertUniversityDialog({ open, onOpenChange, university }: Props) {
    const t = useTranslations('universities');
    const qc = useQueryClient();

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as never,
        defaultValues: {
            unik: '',
            title_kk: '',
            city_id: null,
            website: '',
            phone: '',
            email: '',
            instagram: '',
            address: '',
            has_dormitory: false,
            has_military_department: false,
            short_desc_kk: '',
            full_desc_kk: '',
        },
    });

    useEffect(() => {
        if (open && university) {
            form.reset({
                unik: university.unik,
                title_kk: university.title_kk,
                city_id: university.city_id,
                website: university.website ?? '',
                phone: university.phone ?? '',
                email: university.email ?? '',
                instagram: university.instagram ?? '',
                address: university.address ?? '',
                has_dormitory: university.has_dormitory,
                has_military_department: university.has_military_department,
                short_desc_kk: university.short_desc_kk ?? '',
                full_desc_kk: university.full_desc_kk ?? '',
            });
        } else if (open && !university) {
            form.reset({
                unik: '',
                title_kk: '',
                city_id: null,
                website: '',
                phone: '',
                email: '',
                instagram: '',
                address: '',
                has_dormitory: false,
                has_military_department: false,
                short_desc_kk: '',
                full_desc_kk: '',
            });
        }
    }, [open, university, form]);

    const mutation = useMutation({
        mutationFn: async (payload: UpsertUniversityPayload) => {
            if (university) return updateUniversity(university.id, payload);
            return createUniversity(payload);
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['admin.universities.list'] });
            if (university) {
                await qc.invalidateQueries({ queryKey: ['admin.universities.detail', String(university.id)] });
            }
            toast.success(t(university ? 'updated_toast' : 'created_toast'));
            onOpenChange(false);
        },
        onError: (e: Error) => {
            toast.error(e.message || t('error_generic'));
        },
    });

    const onSubmit = form.handleSubmit((values) => mutation.mutate(toPayload(values)));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{university ? t('edit_title') : t('create_title')}</DialogTitle>
                    <DialogDescription>{t('upsert_description')}</DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-1'>
                            <Label>{t('field_unik')} *</Label>
                            <Input {...form.register('unik')} />
                            {form.formState.errors.unik ? (
                                <p className='text-xs text-destructive'>{t('error_unik_invalid')}</p>
                            ) : null}
                        </div>
                        <div className='space-y-1'>
                            <Label>{t('field_city_id')}</Label>
                            <Input
                                type='number'
                                {...form.register('city_id', { setValueAs: (v) => (v === '' ? null : Number(v)) })}
                                placeholder={t('field_city_id_hint')}
                            />
                        </div>
                    </div>
                    <div className='space-y-1'>
                        <Label>{t('field_title_kk')} *</Label>
                        <Input {...form.register('title_kk')} />
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-1'>
                            <Label>{t('field_website')}</Label>
                            <Input {...form.register('website')} />
                        </div>
                        <div className='space-y-1'>
                            <Label>{t('field_phone')}</Label>
                            <Input {...form.register('phone')} />
                        </div>
                        <div className='space-y-1'>
                            <Label>{t('field_email')}</Label>
                            <Input type='email' {...form.register('email')} />
                        </div>
                        <div className='space-y-1'>
                            <Label>{t('field_instagram')}</Label>
                            <Input {...form.register('instagram')} />
                        </div>
                    </div>
                    <div className='space-y-1'>
                        <Label>{t('field_address')}</Label>
                        <Input {...form.register('address')} />
                    </div>
                    <div className='flex flex-wrap gap-6'>
                        <label className='flex items-center gap-2 text-sm'>
                            <Checkbox
                                checked={form.watch('has_dormitory')}
                                onCheckedChange={(v) => form.setValue('has_dormitory', !!v)}
                            />
                            {t('field_has_dormitory')}
                        </label>
                        <label className='flex items-center gap-2 text-sm'>
                            <Checkbox
                                checked={form.watch('has_military_department')}
                                onCheckedChange={(v) => form.setValue('has_military_department', !!v)}
                            />
                            {t('field_has_military')}
                        </label>
                    </div>
                    <div className='space-y-1'>
                        <Label>{t('field_short_desc_kk')}</Label>
                        <Textarea rows={3} {...form.register('short_desc_kk')} />
                    </div>
                    <div className='space-y-1'>
                        <Label>{t('field_full_desc_kk')}</Label>
                        <Textarea rows={6} {...form.register('full_desc_kk')} />
                    </div>
                    <DialogFooter>
                        <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                            {t('cancel')}
                        </Button>
                        <Button type='submit' disabled={mutation.isPending}>
                            {mutation.isPending ? t('saving') : t('save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
