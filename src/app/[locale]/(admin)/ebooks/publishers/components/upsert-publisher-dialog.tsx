'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { createPublisher, updatePublisher } from '@/lib/ebooks/api';
import type { PublisherRow } from '@/lib/ebooks/types';

/**
 * Create/edit dialog for the publishers reference table (name-only entity).
 *
 * `publisher === null` → create mode (POST /publishers), otherwise edit mode
 * (PATCH /publishers/:id). Publisher.name is UNIQUE server-side; a duplicate
 * comes back as 409 `publishers.name_taken`, surfaced verbatim as a toast.
 */
const publisherSchema = z.object({
    name: z.string().min(1).max(255),
});

type PublisherValues = z.infer<typeof publisherSchema>;

export interface UpsertPublisherDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    publisher: PublisherRow | null;
}

export function UpsertPublisherDialog({ open, onOpenChange, publisher }: UpsertPublisherDialogProps) {
    const t = useTranslations('admin.ebooks');
    const qc = useQueryClient();
    const isEdit = publisher !== null;

    const form = useForm<PublisherValues>({
        resolver: zodResolver(publisherSchema),
        defaultValues: { name: publisher?.name ?? '' },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) form.reset({ name: publisher?.name ?? '' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, publisher?.id]);

    const mutation = useMutation({
        // Create and update return different envelopes (created_at vs updated_at);
        // narrow both to the id+name the dialog actually needs.
        mutationFn: async (values: PublisherValues): Promise<{ id: number; name: string }> => {
            const payload = { name: values.name.trim() };
            const result = isEdit ? await updatePublisher(publisher!.id, payload) : await createPublisher(payload);
            return { id: result.id, name: result.name };
        },
        onSuccess: () => {
            toast.success(isEdit ? t('publisher_updated_success') : t('publisher_created_success'));
            qc.invalidateQueries({ queryKey: ['admin.publishers.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.ebooks.list'], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>{isEdit ? t('publisher_edit_title') : t('publisher_create_title')}</DialogTitle>
                    <DialogDescription>{t('publisher_dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='space-y-4'>
                        <FormField
                            control={form.control}
                            name='name'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('publisher_name_label')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder={t('publisher_name_placeholder')} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('loading') : t('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
