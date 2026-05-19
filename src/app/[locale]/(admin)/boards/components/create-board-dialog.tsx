'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateBoard } from '@/lib/boards/queries';

const createBoardSchema = z.object({
    name: z.string().min(1).max(128),
    description: z.string().max(8000).optional().or(z.literal('')),
    color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/u, 'invalid_color')
        .optional()
        .or(z.literal('')),
});

type CreateBoardValues = z.infer<typeof createBoardSchema>;

const COLOR_SWATCHES = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#facc15', '#06b6d4', '#64748b'];

interface CreateBoardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateBoardDialog({ open, onOpenChange }: CreateBoardDialogProps) {
    const t = useTranslations('admin.boards');
    const locale = useLocale();
    const router = useRouter();
    const mutation = useCreateBoard();

    const form = useForm<CreateBoardValues>({
        resolver: zodResolver(createBoardSchema),
        defaultValues: { name: '', description: '', color: COLOR_SWATCHES[0] },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (!open) form.reset({ name: '', description: '', color: COLOR_SWATCHES[0] });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const onSubmit = (values: CreateBoardValues) => {
        mutation.mutate(
            {
                name: values.name.trim(),
                description: values.description?.trim() || undefined,
                color: values.color || undefined,
            },
            {
                onSuccess: (created) => {
                    toast.success(t('create_success'));
                    onOpenChange(false);
                    router.push(`/${locale}/boards/${created.id}`);
                },
                onError: () => toast.error(t('create_failed')),
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('create')}</DialogTitle>
                    <DialogDescription className="sr-only">{t('subtitle')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('form.name_label')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('form.name_placeholder')} autoFocus {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('form.description_label')}</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder={t('form.description_placeholder')}
                                            rows={3}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="color"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('form.color_label')}</FormLabel>
                                    <FormControl>
                                        <div className="flex flex-wrap gap-2">
                                            {COLOR_SWATCHES.map((c) => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => field.onChange(c)}
                                                    aria-pressed={field.value === c}
                                                    style={{ backgroundColor: c }}
                                                    className={`h-7 w-7 rounded-full ring-offset-2 transition focus:outline-none focus:ring-2 focus:ring-primary ${
                                                        field.value === c ? 'ring-2 ring-primary' : ''
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                                {t('form.cancel')}
                            </Button>
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending ? t('creating') : t('create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
