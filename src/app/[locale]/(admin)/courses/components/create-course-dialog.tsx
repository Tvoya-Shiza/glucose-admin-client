'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPicker } from '@/components/users/user-picker';
import { CategoryPicker } from '@/components/courses/category-picker';
import { createCourse } from '@/lib/courses/api';
import { SLUG_REGEX, slugify } from '@/lib/courses/format';
import type { CreateCourseStatus, Translation } from '@/lib/courses/types';

/**
 * Form schema for the create-course flow (CRS-01).
 *
 * Slug is validated against SLUG_REGEX (kebab-case) at the boundary; admin-api also
 * validates `@Length(3, 255)`.
 *
 * teacher_id is now a numeric value sourced from the searchable UserPicker. The
 * picker emits `null` until a teacher is chosen; we encode "no selection" as `0`
 * in the form value so the same `.positive()` check that catches manual zero-entry
 * also catches "operator hit submit without picking anyone."
 *
 * category_id is optional — backend DTO accepts `category_id?: number | null`.
 *
 * RU translation is required (CONTEXT D-03 — RU canonical); KZ translation title
 * is required at create time too because the Phase 5 i18n posture treats KZ as
 * a first-class locale, but the create payload only sends translations[] for
 * locales the user filled in (admin-api accepts 1..2).
 */
const createCourseSchema = z.object({
    slug: z
        .string()
        .min(3)
        .max(255)
        .refine((v) => SLUG_REGEX.test(v), { message: 'slug_invalid_format' }),
    status: z.enum(['active', 'pending', 'is_draft']),
    teacher_id: z.number().int().positive({ message: 'teacher_id_invalid' }),
    category_id: z.number().int().positive().nullable(),
    ru_title: z.string().min(1).max(255),
    ru_description: z.string().max(65535).optional(),
    kz_title: z.string().min(1).max(255),
    kz_description: z.string().max(65535).optional(),
});

type CreateCourseValues = z.infer<typeof createCourseSchema>;

export interface CreateCourseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Actor role, used to lock teacher_id when actor is a teacher. */
    actorRole: 'admin' | 'teacher';
    /** Actor user_id (used as default teacher_id when actorRole='teacher'). */
    actorId: number | null;
}

/**
 * CRS-01 — admin/teacher course creation dialog with side-by-side RU+KZ
 * translation tabs.
 *
 * react-hook-form + zod (Phase 2/3/4 pattern). Slug auto-generates from RU title
 * via `slugify`; the user can override manually (auto-sync stops once they touch
 * the slug field).
 *
 * On success: invalidates ['admin.courses.list'], toast success, navigates to the
 * new course's detail page (Plan 03 ships /[locale]/courses/[id]).
 *
 * Teacher actors: teacher_id is locked to the actor's user_id (CRS-07 mitigation —
 * server-side gate re-checks T-05-10).
 */
export function CreateCourseDialog({
    open,
    onOpenChange,
    actorRole,
    actorId,
}: CreateCourseDialogProps) {
    const t = useTranslations('admin.courses');
    const locale = useLocale() as 'ru' | 'kz';
    const router = useRouter();
    const qc = useQueryClient();

    const [slugTouched, setSlugTouched] = useState(false);

    const form = useForm<CreateCourseValues>({
        resolver: zodResolver(createCourseSchema),
        defaultValues: {
            slug: '',
            status: 'is_draft',
            teacher_id: actorRole === 'teacher' && actorId ? actorId : 0,
            category_id: null,
            ru_title: '',
            ru_description: '',
            kz_title: '',
            kz_description: '',
        },
        mode: 'onSubmit',
    });

    // Reset on close so re-open shows a fresh form.
    useEffect(() => {
        if (!open) {
            form.reset({
                slug: '',
                status: 'is_draft',
                teacher_id: actorRole === 'teacher' && actorId ? actorId : 0,
                category_id: null,
                ru_title: '',
                ru_description: '',
                kz_title: '',
                kz_description: '',
            });
            setSlugTouched(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Auto-fill slug from RU title until the user touches the slug input.
    const ruTitle = form.watch('ru_title');
    useEffect(() => {
        if (!slugTouched) {
            form.setValue('slug', slugify(ruTitle ?? ''), { shouldValidate: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ruTitle, slugTouched]);

    const mutation = useMutation({
        mutationFn: (values: CreateCourseValues) => {
            const translations: Translation[] = [
                { locale: 'ru', title: values.ru_title, description: values.ru_description || null },
                { locale: 'kz', title: values.kz_title, description: values.kz_description || null },
            ];
            return createCourse({
                slug: values.slug,
                status: values.status as CreateCourseStatus,
                teacher_id: values.teacher_id,
                category_id: values.category_id ?? null,
                translations,
            });
        },
        onSuccess: (created) => {
            toast.success(t('created_success'));
            qc.invalidateQueries({ queryKey: ['admin.courses.list'], exact: false });
            onOpenChange(false);
            // Plan 03 lands /[locale]/courses/[id]; until then this navigates to a placeholder.
            router.push(`/${locale}/courses/${created.id}`);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('created_error');
            toast.error(msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{t('create_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('create_dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                        className='space-y-4'
                    >
                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='slug'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('slug_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={t('slug_placeholder')}
                                                {...field}
                                                onChange={(e) => {
                                                    setSlugTouched(true);
                                                    field.onChange(e.target.value);
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='status'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('status_label')}</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('status_label')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value='active'>
                                                    {t('status_active')}
                                                </SelectItem>
                                                <SelectItem value='pending'>
                                                    {t('status_pending')}
                                                </SelectItem>
                                                <SelectItem value='is_draft'>
                                                    {t('status_is_draft')}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='teacher_id'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('teacher_label')}</FormLabel>
                                        <FormControl>
                                            <UserPicker
                                                roles={['teacher']}
                                                value={field.value > 0 ? field.value : null}
                                                onChange={(id) => field.onChange(id ?? 0)}
                                                placeholder={t('teacher_picker_placeholder')}
                                                // Lock the field for teacher actors per CRS-07 (T-05-10 mitigation).
                                                disabled={actorRole === 'teacher'}
                                                initialLabel={
                                                    actorRole === 'teacher' && actorId
                                                        ? `#${actorId}`
                                                        : null
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='category_id'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('category_label')}</FormLabel>
                                        <FormControl>
                                            <CategoryPicker
                                                value={field.value ?? null}
                                                onChange={(id) => field.onChange(id)}
                                                placeholder={t('category_placeholder')}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Tabs defaultValue='ru' className='w-full'>
                            <TabsList className='grid w-full grid-cols-2'>
                                <TabsTrigger value='ru'>{t('ru_translation')}</TabsTrigger>
                                <TabsTrigger value='kz'>{t('kz_translation')}</TabsTrigger>
                            </TabsList>
                            <TabsContent value='ru' className='space-y-3'>
                                <FormField
                                    control={form.control}
                                    name='ru_title'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('title_label')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('title_placeholder')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='ru_description'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('description_label')}</FormLabel>
                                            <FormControl>
                                                <textarea
                                                    className='border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2'
                                                    placeholder={t('description_placeholder')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>
                            <TabsContent value='kz' className='space-y-3'>
                                <FormField
                                    control={form.control}
                                    name='kz_title'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('title_label')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('title_placeholder')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='kz_description'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('description_label')}</FormLabel>
                                            <FormControl>
                                                <textarea
                                                    className='border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2'
                                                    placeholder={t('description_placeholder')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>
                        </Tabs>

                        <DialogFooter>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => onOpenChange(false)}
                                disabled={mutation.isPending}
                            >
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('loading') : t('create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
