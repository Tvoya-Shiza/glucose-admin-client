'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { TRAINER_THEME_PALETTES } from '@shared/trainers';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileUploader } from '@/components/ui/file-uploader';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { createTrainerTheme, updateTrainerTheme } from '@/lib/trainers/api';
import { TRAINER_PALETTE_LABELS, TRAINER_PALETTE_SWATCHES } from '@/lib/trainers/theme-palettes';
import type { TrainerThemeRow } from '@/lib/trainers/types';

/**
 * Создание/правка темы оформления (phase-43).
 *
 * `theme === null` — создание (POST), иначе правка (PATCH /:id). Название
 * уникально на сервере: дубль возвращается 409 `trainer-themes.duplicate` и
 * показывается тостом как есть.
 *
 * Палитра выбирается из готовых наборов, а не пипеткой: произвольный цвет легко
 * увести в нечитаемый контраст с белым текстом плиток.
 */
const themeSchema = z.object({
    title: z.string().min(1).max(255),
    image: z.string().max(512).nullable(),
    palette: z.enum(TRAINER_THEME_PALETTES),
    sort_order: z.number().int().min(0),
    is_active: z.boolean(),
});

type ThemeValues = z.infer<typeof themeSchema>;

export interface UpsertThemeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    theme: TrainerThemeRow | null;
}

function toDefaults(theme: TrainerThemeRow | null): ThemeValues {
    return {
        title: theme?.title ?? '',
        image: theme?.image ?? null,
        palette: theme?.palette ?? 'classic',
        sort_order: theme?.sort_order ?? 0,
        is_active: theme?.is_active ?? true,
    };
}

export function UpsertThemeDialog({ open, onOpenChange, theme }: UpsertThemeDialogProps) {
    const t = useTranslations('admin.trainers');
    const qc = useQueryClient();
    const isEdit = theme !== null;

    const form = useForm<ThemeValues>({
        resolver: zodResolver(themeSchema),
        defaultValues: toDefaults(theme),
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) form.reset(toDefaults(theme));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, theme?.id]);

    const mutation = useMutation({
        mutationFn: async (values: ThemeValues) => {
            const payload = {
                title: values.title.trim(),
                image: values.image,
                palette: values.palette,
                sort_order: values.sort_order,
                is_active: values.is_active,
            };
            return isEdit ? updateTrainerTheme(theme!.id, payload) : createTrainerTheme(payload);
        },
        onSuccess: () => {
            toast.success(isEdit ? t('themes_updated_success') : t('themes_created_success'));
            qc.invalidateQueries({ queryKey: ['admin.trainer-themes.list'], exact: false });
            // Деталь тренажёра показывает название темы — обновляем и её.
            qc.invalidateQueries({ queryKey: ['admin.trainers.detail'], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : t('generic_error')),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>{isEdit ? t('themes_edit') : t('themes_create')}</DialogTitle>
                    <DialogDescription>{t('themes_dialog_hint')}</DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form className='space-y-4' onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
                        <FormField
                            control={form.control}
                            name='title'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('themes_col_title')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder={t('themes_title_placeholder')} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='image'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('themes_image')}</FormLabel>
                                    <FormControl>
                                        <FileUploader
                                            kind='cover'
                                            variant='inline'
                                            value={field.value}
                                            onChange={(url) => field.onChange(url)}
                                            onClear={() => field.onChange(null)}
                                        />
                                    </FormControl>
                                    <FormDescription>{t('themes_image_hint')}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='palette'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('themes_col_palette')}</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {TRAINER_THEME_PALETTES.map((key) => (
                                                <SelectItem key={key} value={key}>
                                                    <span className='flex items-center gap-2'>
                                                        <span className='flex gap-1'>
                                                            {TRAINER_PALETTE_SWATCHES[key].map((color) => (
                                                                <span
                                                                    key={color}
                                                                    className='size-3.5 rounded-full ring-1 ring-black/10'
                                                                    style={{ backgroundColor: color }}
                                                                />
                                                            ))}
                                                        </span>
                                                        {TRAINER_PALETTE_LABELS[key]}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>{t('themes_palette_hint')}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className='grid gap-4 sm:grid-cols-2'>
                            <FormField
                                control={form.control}
                                name='sort_order'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('themes_col_order')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type='number'
                                                min={0}
                                                value={field.value}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name='is_active'
                                render={({ field }) => (
                                    <FormItem className='flex flex-col justify-end'>
                                        <FormLabel>{t('themes_col_status')}</FormLabel>
                                        <FormControl>
                                            <div className='flex h-9 items-center gap-2'>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                <span className='text-muted-foreground text-sm'>
                                                    {field.value ? t('themes_active') : t('themes_hidden')}
                                                </span>
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button type='button' variant='ghost' onClick={() => onOpenChange(false)}>
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {isEdit ? t('save') : t('themes_create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
